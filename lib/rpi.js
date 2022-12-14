import { Config, CSV, Exceptions, Files } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

const HTML_FILE_NAME = "rpi.html";
const URL_RPI_LIST = "https://rareplants.cnps.org/Search/result?frm=T&life=tree:herb:shrub:vine:leaf:stem";

class RPI {

    static #rpiData = {};

    static async analyze( toolsDataDir, Taxa ) {

        const toolsDataPath = toolsDataDir + "/rpi";
        const fileName = "rpi.csv";
        const filePath = toolsDataPath + "/" + fileName;

        // Create data directory if it's not there.
        Files.mkdir( toolsDataPath );

        // Download the data file if it doesn't exist.
        if ( !Files.exists( filePath ) ) {

            console.log( "retrieving " + filePath );

            // To download results in a spreadsheet, first need to retrieve the search results HTML, which sets the
            // ASP.NET_SessionId session cookie, then retrieve the CSV, which retrieves the query from the session.
            const headers = await Files.fetch( URL_RPI_LIST, toolsDataPath + "/" + HTML_FILE_NAME );

            const options = { headers: { cookie: headers.get( "set-cookie" ) } };
            await Files.fetch( "https://rareplants.cnps.org/PlantExport/SearchResults", filePath, options );

        }

        const countyCodes = Config.getCountyCodes();

        const csv = CSV.parseFile( toolsDataPath, fileName );
        for ( const row of csv ) {
            const rpiName = row[ "ScientificName" ].replace( " ssp.", " subsp." );
            const translatedName = Exceptions.getValue( rpiName, "rpi", "translation" );
            this.#rpiData[ rpiName ] = row;
            const name = translatedName ? translatedName : rpiName;
            const rank = row[ "CRPR" ];
            const rawCESA = row[ "CESA" ];
            const cesa = ( rawCESA === "None" ) ? undefined : rawCESA;
            const taxon = Taxa.getTaxon( name );

            const shouldBeHere = this.#shouldBeHere( row, countyCodes );

            if ( shouldBeHere ) {
                if ( !taxon ) {
                    if ( cesa ) {
                        LogMessage.log( name, "is CESA listed but not found in taxa.csv", cesa );
                    }
                    if ( this.#hasExceptions( name, "notingeo" ) ) {
                        continue;
                    }
                    if ( this.#hasExceptions( name, "extirpated" ) && ( rank === "1A" || rank === "2A" ) ) {
                        // It is state ranked, but extirpated statewide, so we are not tracking it.
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
                if ( taxon.isNative() && !this.#hasExceptions( name, "ingeo" ) ) {
                    // If it is a local native in taxa.csv, warn.
                    LogMessage.log( name, "in taxa.csv but not listed for local counties", rank );
                }
            }

            if ( rank !== taxon.getRPIRankAndThreat() ) {
                if ( taxon.isNative() ) {
                    LogMessage.log( name, "rank in taxa.csv is different than rank in " + fileName, taxon.getRPIRankAndThreat(), rank );
                }
            }
            if ( cesa !== taxon.getCESA() ) {
                LogMessage.log( name, "CESA status in taxa.csv is different than status in " + fileName, taxon.getCESA(), cesa );
            }

            if ( !taxon.isCANative() && !this.#hasExceptions( name, "non-native" ) ) {
                LogMessage.log( name, "is in RPI but not native in taxa.csv" );
            }
        }

        this.#checkExceptions( Taxa );

    }

    static #checkExceptions( Taxa ) {

        const countyCodes = Config.getCountyCodes();

        // Check the RPI exceptions and make sure they still apply.
        for ( const [ name, v ] of Exceptions.getExceptions() ) {

            const exceptions = v.rpi;
            if ( !exceptions ) {
                continue;
            }

            const translatedName = Exceptions.getValue( name, "rpi", "translation" );

            const taxon = Taxa.getTaxon( translatedName ? translatedName : name );

            // Make sure it is actually in RPI data.
            const rpiData = this.#rpiData[ name ];
            if ( !rpiData ) {
                // Ignore it if there is a "translation-to-rpi" entry.
                if ( !exceptions[ "translation-to-rpi" ] ) {
                    LogMessage.log( name, "has rpi exception but is not in rpi.csv" );
                }
            }

            for ( const [ k, v ] of Object.entries( exceptions ) ) {
                switch ( k ) {
                    case "extirpated": {
                        // Make sure the taxon is not in our list.
                        if ( taxon ) {
                            LogMessage.log( name, "has rpi extirpated exception but is in taxa.csv" );
                        }
                        // Make sure it has extirpated RPI status.
                        const rank = rpiData[ "CRPR" ];
                        if ( rank !== "1A" && rank !== "2A" ) {
                            LogMessage.log( name, "has rpi extirpated exception rank is not 1A or 2A" );

                        }
                        break;
                    }
                    case "ingeo":
                        // Make sure the taxon is in our list.
                        if ( !taxon ) {
                            LogMessage.log( name, "has rpi ingeo exception but is not in taxa.csv" );
                        }
                        // Make sure it is no listed in local area in RPI.
                        if ( this.#shouldBeHere( rpiData, countyCodes ) ) {
                            LogMessage.log( name, "has rpi ingeo exception but is listed in local counties in rpi.csv" );
                        }
                        break;
                    case "non-native":
                        // Make sure the taxon is in our list.
                        if ( !taxon ) {
                            LogMessage.log( name, "has rpi non-native exception but is not in taxa.csv" );
                            continue;
                        }
                        // Make sure it is non-native in our list.
                        if ( taxon.isCANative() ) {
                            LogMessage.log( name, "has rpi non-native exception but is native in local list" );
                        }
                        break;
                    case "notingeo":
                        // Make sure the taxon is not in our list.
                        if ( taxon ) {
                            LogMessage.log( name, "has rpi notingeo exception but is in taxa.csv" );
                        }
                        // Make sure it is listed in local area in RPI.
                        if ( !this.#shouldBeHere( rpiData, countyCodes ) ) {
                            LogMessage.log( name, "has rpi notingeo exception but is not listed in local counties in rpi.csv" );
                        }
                        break;
                    case "translation": {
                        // Make sure the translated name is in our list.
                        if ( !taxon ) {
                            LogMessage.log( name, "has rpi translation exception, but target not found" );
                        }
                        // Make sure there is a matching translation exception.
                        const translatedName = Exceptions.getValue( v, "rpi", "translation-to-rpi" );
                        if ( translatedName !== name ) {
                            LogMessage.log( name, "has rpi translation exception, but no reverse translation" );
                        }
                        break;
                    }
                    case "translation-to-rpi": {
                        // Make sure there is a matching translation exception.
                        const translatedName = Exceptions.getValue( v, "rpi", "translation" );
                        if ( translatedName !== name ) {
                            LogMessage.log( name, "has rpi translation-to-rpi exception, but no reverse translation" );
                        }
                        break;
                    }
                    default:
                        LogMessage.log( name, "unrecognized rpi exception", k );
                }
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

    static async scrape( toolsDataDir, Taxa ) {

        const toolsDataPath = toolsDataDir + "/rpi";
        const fileName = HTML_FILE_NAME;
        const filePath = toolsDataPath + "/" + fileName;

        // Create data directory if it's not there.
        Files.mkdir( toolsDataPath );

        // Download the data file if it doesn't exist.
        if ( !Files.exists( filePath ) ) {
            console.log( "retrieving " + filePath );
            await Files.fetch( URL_RPI_LIST, filePath );
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
            const translatedName = Exceptions.getValue( name, "rpi", "translation-to-rpi", name );
            const id = rpiIDs[ translatedName ];
            if ( !id ) {
                LogMessage.log( name, "not found in RPI HTML", translatedName );
            }
            if ( id !== taxon.getRPIID() ) {
                LogMessage.log( name, "RPI ID in " + fileName + " does not match site data", id, taxon.getRPIID() );
            }
        }
    }

    static #shouldBeHere( row, countyCodes ) {
        const rpiCounties = row[ "Counties" ];
        for ( const countyCode of countyCodes ) {
            if ( rpiCounties.includes( countyCode ) ) {
                return true;
            }
        }
        return false;
    }

}

export { RPI };