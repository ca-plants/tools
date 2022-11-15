import fetch from "node-fetch";
import { CSV } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

class INat {

    static #taxa = {};

    static async analyze( fileName, Taxa ) {
        await CSV.parseStream( "./external_data", fileName, undefined, undefined, this.#checkTaxon );
        console.log( "iNat: " + Object.keys( this.#taxa ).length + " taxa loaded" );

        const missingTaxa = [];

        for ( const taxon of Taxa.getTaxa() ) {
            const name = taxon.getName();
            if ( name.includes( " unknown" ) ) {
                continue;
            }
            const iNatName = taxon.getINatName();
            const iNatTaxon = this.#taxa[ iNatName ];
            if ( !iNatTaxon ) {
                LogMessage.log( name, "not found in " + fileName, iNatName );
                missingTaxa.push( { name: name, iNatName: iNatName } );
                continue;
            }
            if ( iNatTaxon.getID() !== taxon.getINatID() ) {
                LogMessage.log(
                    name,
                    "iNat ID in " + fileName + " does not match ID in taxa.csv",
                    iNatTaxon.getID(),
                    taxon.getINatID()
                );
            }
        }

        console.log( "iNat: looking up missing names" );
        for ( const data of missingTaxa ) {
            await this.#findCurrentName( data.name, data.iNatName );
        }
    }

    static #checkTaxon( record ) {
        if ( record[ "phylum" ] === "Tracheophyta" && record[ "specificEpithet" ] ) {
            const name = record[ "scientificName" ];
            INat.#taxa[ name ] = new InatTaxon( record[ "id" ], name );
        }
    }

    static async #findCurrentName( name, iNatName ) {

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
                        LogMessage.log( iNatName, "found more than one matched_term", match.matched_term, result.matched_term );
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
            LogMessage.log( name, "iNat lookup found no results" );
        } else {
            LogMessage.log( name, "found iNat synonym", this.makeSynonymName( result ) + "," + name + ",INAT" );
        }

        // Delay to throttle queries to iNat API.
        await delay( 800 );
    }

    static makeSynonymName( iNatResult ) {
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
                    LogMessage.log( iNatResult.name, "unrecognized iNat rank", iNatResult.rank );
            }
        }
        return synParts.join( " " );
    }

}

class InatTaxon {

    #id;

    constructor( id ) {
        this.#id = id;
    }

    getID() {
        return this.#id;
    }
}

export { INat };