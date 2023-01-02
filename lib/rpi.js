import { Config, CSV, Exceptions, Files } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

class RPI {

    static async analyze( toolsDataDir, Taxa ) {

        const toolsDataPath = toolsDataDir + "/rpi";
        const fileName = "rpi.csv";
        const filePath = toolsDataPath + "/" + fileName;

        // Create data directory if it's not there.
        Files.mkdir( toolsDataPath );

        // Download the data file if it doesn't exist.
        if ( !Files.exists( filePath ) ) {

            // To download results in a spreadsheet, first need to retrieve the search results HTML, which sets the
            // ASP.NET_SessionId session cookie, then retrieve the CSV, which retrieves the query from the session.
            const headers = await Files.fetchHeaders( "https://rareplants.cnps.org/Search/result?frm=T&life=tree:herb:shrub:vine:leaf:stem" );

            const options = { headers: { cookie: headers.get( "set-cookie" ) } };
            await Files.fetch( "https://rareplants.cnps.org/PlantExport/SearchResults", filePath, options );
        }

        const countyCodes = Config.getCountyCodes();

        const csv = CSV.parseFile( toolsDataPath, fileName );
        for ( const row of csv ) {
            const rpiName = row[ "ScientificName" ].replace( " ssp.", " subsp." );
            const translatedName = Exceptions.getValue( rpiName, "rpi", "translation" );
            const name = translatedName ? translatedName : rpiName;
            const rank = row[ "CRPR" ];
            const rawCESA = row[ "CESA" ];
            const rpiCounties = row[ "Counties" ];
            const cesa = ( rawCESA === "None" ) ? undefined : rawCESA;
            const taxon = Taxa.getTaxon( name );

            let shouldBeHere = false;
            for ( const countyCode of countyCodes ) {
                if ( rpiCounties.includes( countyCode ) ) {
                    shouldBeHere = true;
                    break;
                }
            }

            if ( shouldBeHere ) {
                if ( !taxon ) {
                    if ( cesa ) {
                        LogMessage.log( name, "is CESA listed but not found in taxa.csv", cesa );
                    }
                    if ( this.#hasExceptions( name, "notingeo" ) ) {
                        continue;
                    }
                    LogMessage.log( name, "in RPI but not found in taxa.csv", rank );
                    continue;
                }
            } else {
                if ( !taxon ) {
                    // Not in taxa.csv, and also not listed for local counties, so ignore it.
                    continue;
                }
                if ( taxon.isNative() ) {
                    // If it is a local native in taxa.csv, warn.
                    LogMessage.log( name, "in taxa.csv but not listed for local counties", rank );
                }
            }

            if ( rank !== taxon.getRPIRankAndThreat() ) {
                if ( !this.#hasExceptions( name, "non-native" ) && taxon.isNative() ) {
                    LogMessage.log( name, "rank in taxa.csv is different than rank in " + fileName, taxon.getRPIRankAndThreat(), rank );
                }
            }
            if ( cesa !== taxon.getCESA() ) {
                LogMessage.log( name, "CESA status in taxa.csv is different than status in " + fileName, taxon.getCESA(), cesa );
            }
        }
    }

    static #hasExceptions( name, ...args ) {
        for ( const arg of args ) {
            if ( Exceptions.hasException( name, "rpi", arg ) ) {
                return true;
            }
        }
        return false;
    }

    static async scrape( Taxa, retrieveToolData ) {

        const fileName = "rpi.html";
        const filePath = "./external_data/" + fileName;

        if ( retrieveToolData ) {
            const url = "https://rareplants.cnps.org/Search/result?frm=T&life=tree:herb:shrub:vine:leaf:stem";
            console.log( "retrieving " + url );
            await Files.fetch( url, filePath );
        }

        const html = Files.read( filePath );
        const re = /href="\/Plants\/Details\/(\d+)".*?>(.*?)<\/a>/gs;
        const matches = [ ...html.matchAll( re ) ];
        const rpiIDs = {};
        for ( const match of matches ) {
            const id = match[ 1 ];
            const name = match[ 2 ].replaceAll( /<\/?em>/g, "" ).trim().replace( " ssp.", " subsp." );
            rpiIDs[ name ] = id;
        }

        for ( const taxon of Taxa.getTaxa() ) {
            if ( !taxon.getRPIRankAndThreat() ) {
                continue;
            }
            const name = taxon.getName();
            const translatedName = Exceptions.getValue( name, "rpi", "translate", name );
            const id = rpiIDs[ translatedName ];
            if ( !id ) {
                LogMessage.log( name, "not found in RPI HTML", translatedName );
            }
            if ( id !== taxon.getRPIID() ) {
                LogMessage.log( name, "RPI ID in " + fileName + " does not match site data", id, taxon.getRPIID() );
            }
        }
    }

}

export { RPI };