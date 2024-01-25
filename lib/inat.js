import path from "node:path";
import { CSV, Files } from "@ca-plant-list/ca-plant-list";

class INat {

    static #taxa = {};

    static async analyze( toolsDataDir, taxa, exceptions, errorLog, csvFileName ) {

        const inatDataDir = toolsDataDir + "/inat";
        const csvFilePath = inatDataDir + "/" + csvFileName;

        // Create data directory if it's not there.
        Files.mkdir( inatDataDir );

        // Download the data file if it doesn't exist.
        if ( !Files.exists( csvFilePath ) ) {
            const url = "https://www.inaturalist.org/taxa/inaturalist-taxonomy.dwca.zip";
            const zipFileName = path.basename( url );
            const zipFilePath = inatDataDir + "/" + zipFileName;
            console.log( "retrieving iNaturalist species" );
            await Files.fetch( url, zipFilePath );
            await Files.zipFileExtract( zipFilePath, "taxa.csv", csvFilePath );
        }

        console.log( "loading iNaturalist species" );
        await CSV.parseStream( inatDataDir, csvFileName, undefined, undefined, this.#checkTaxon );
        console.log( "iNat: " + Object.keys( this.#taxa ).length + " taxa loaded" );

        const missingTaxa = [];

        for ( const taxon of taxa.getTaxonList() ) {
            const name = taxon.getName();
            if ( name.includes( " unknown" ) ) {
                continue;
            }
            const iNatName = taxon.getINatName();
            const iNatTaxon = this.#taxa[ iNatName ];
            if ( !iNatTaxon ) {
                if ( !exceptions.hasException( name, "inat", "notintaxondata" ) ) {
                    errorLog.log( name, "not found in " + csvFileName, iNatName );
                }
                missingTaxa.push( { name: name, iNatName: iNatName } );
                continue;
            }
            if ( iNatTaxon.getID() !== taxon.getINatID() ) {
                errorLog.log(
                    name,
                    "iNat ID in " + csvFileName + " does not match ID in taxa.csv",
                    iNatTaxon.getID(),
                    taxon.getINatID()
                );
            }
        }

        console.log( "iNat: looking up missing names" );
        for ( const data of missingTaxa ) {
            await this.#findCurrentName( taxa, exceptions, errorLog, data.name, data.iNatName );
        }

        this.#checkExceptions( taxa, exceptions, errorLog );
    }

    static #checkExceptions( taxa, exceptions, errorLog ) {

        // Check the iNat exceptions and make sure they still apply.
        for ( const [ name, v ] of exceptions.getExceptions() ) {
            const exceptions = v.inat;
            if ( !exceptions ) {
                continue;
            }

            // Make sure the taxon is still in our list.
            const taxon = taxa.getTaxon( name );
            if ( !taxon ) {
                // Don't process global exceptions if taxon is not in local list.
                if ( taxa.isSubset() && !v.local ) {
                    continue;
                }
                errorLog.log( name, "has iNat exceptions but not in taxa.tsv" );
                continue;
            }

            for ( const [ k ] of Object.entries( exceptions ) ) {
                const iNatData = INat.#taxa[ name ];
                switch ( k ) {
                    case "notintaxondata":
                        if ( iNatData ) {
                            errorLog.log( name, "found in iNat data but has notintaxondata exception" );
                        }
                        break;
                    default:
                        errorLog.log( name, "unrecognized iNat exception", k );
                }
            }
        }
    }

    static #checkTaxon( record ) {
        if ( record[ "phylum" ] === "Tracheophyta" && record[ "specificEpithet" ] ) {
            const name = record[ "scientificName" ];
            INat.#taxa[ name ] = new InatTaxon( record[ "id" ] );
        }
    }

    static async #findCurrentName( taxa, exceptions, errorLog, name, iNatName ) {

        function delay( time ) {
            return new Promise( resolve => setTimeout( resolve, time ) );
        }

        function findMatchingResult( results, iNatName ) {
            if ( results.length === 1 ) {
                return results[ 0 ];
            }
            let match;
            for ( const result of results ) {
                if ( result.matched_term === iNatName ) {
                    if ( match ) {
                        errorLog.log( iNatName, "found more than one matched_term", match.matched_term, result.matched_term );
                        return;
                    }
                    match = result;
                }
            }
            return match;
        }

        const url = new URL( "https://api.inaturalist.org/v1/taxa" );
        url.searchParams.set( "q", iNatName );

        const response = await fetch( url );
        const data = await response.json();

        let result = findMatchingResult( data.results, iNatName );
        if ( result === undefined ) {
            const parts = iNatName.split( " " );
            switch ( parts.length ) {
                case 2:
                    // If it's "genus species", try "genus species species".
                    parts.push( parts[ 1 ] );
                    iNatName = parts.join( " " );
                    result = findMatchingResult( data.results, iNatName );
                    break;
                case 3:
                    // If it's "genus species species", try "genus species".
                    if ( parts[ 1 ] === parts[ 2 ] ) {
                        iNatName = parts[ 0 ] + " " + parts[ 1 ];
                        result = findMatchingResult( data.results, iNatName );
                    }
                    break;

            }
        }

        if ( result === undefined ) {
            if ( !exceptions.hasException( name, "inat", "notintaxondata" ) ) {
                errorLog.log( name, "iNat lookup found no results" );
                // Make sure this doesn't have an iNat ID.
                const iNatID = taxa.getTaxon( name ).getINatID();
                if ( iNatID ) {
                    errorLog.log( name, "iNat lookup failed but has iNat ID", iNatID );
                }
            }
        } else {
            errorLog.log( name, "found iNat synonym", this.makeSynonymName( result, errorLog ) + "," + name + ",INAT" );
        }

        // Delay to throttle queries to iNat API.
        await delay( 800 );
    }

    static makeSynonymName( iNatResult, errorLog ) {
        const synParts = iNatResult.name.split( " " );
        if ( synParts.length === 3 ) {
            switch ( iNatResult.rank ) {
                case "subspecies":
                case "variety":
                    synParts[ 3 ] = synParts[ 2 ];
                    synParts[ 2 ] = ( iNatResult.rank === "variety" ) ? "var." : "subsp.";
                    break;
                case "hybrid":
                    // Leave as is.
                    break;
                default:
                    errorLog.log( iNatResult.name, "unrecognized iNat rank", iNatResult.rank );
            }
        }
        return synParts.join( " " );
    }

}

class InatTaxon {

    #id;

    /**
     * @param {string} id 
     */
    constructor( id ) {
        this.#id = id;
    }

    getID() {
        return this.#id;
    }
}

export { INat };