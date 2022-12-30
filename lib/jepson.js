import { Exceptions, Files } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

class Jepson {

    static #nameInfo = {};
    static #loadedLetters = {};

    static async analyze( toolsDataDir, Taxa ) {

        async function loadNameIndex( firstLetter ) {

            async function retrieveIfNotFound( url, targetFile ) {
                // Retrieve file if it's not there.
                if ( Files.exists( targetFile ) ) {
                    return;
                }
                console.log( "retrieving " + targetFile );
                await Files.fetch( url, targetFile );
            }

            const fileName = "I_index_" + firstLetter + ".html";
            const filePath = toolsDataDir + "/" + fileName;
            const url = "https://ucjeps.berkeley.edu/interchange/" + fileName;

            await retrieveIfNotFound( url, filePath );

            const html = Files.read( filePath );
            const re = /href="\/cgi-bin\/get_cpn\.pl\?(\d+)".*?>(.*?)<\/a>/gs;
            const matches = [ ...html.matchAll( re ) ];
            for ( const match of matches ) {
                const id = match[ 1 ];
                const data = match[ 2 ].split( "JFP" );
                if ( data.length !== 2 ) {
                    throw new Error( data );
                }
                const name = data[ 0 ].trim();
                const category = "JFP" + data[ 1 ];
                Jepson.#nameInfo[ name ] = { id: id, category: category };
            }

            Jepson.#loadedLetters[ firstLetter ] = true;
        }

        async function getJepsInfo( name ) {
            const firstLetter = name[ 0 ];
            // See if this index has been loaded.
            if ( !Jepson.#loadedLetters[ firstLetter ] ) {
                await loadNameIndex( firstLetter );
            }

            return Jepson.#getJepsInfo( name );
        }

        for ( const taxon of Taxa.getTaxa() ) {

            const name = taxon.getName();
            if ( name.includes( " unknown" ) ) {
                continue;
            }

            const jepsInfo = await getJepsInfo( name );
            if ( jepsInfo === undefined ) {
                // Not found in the index; log it unless there is an exception.
                if ( !Exceptions.hasException( name, "jepson", "notinnameindex" ) ) {
                    LogMessage.log( name, "not found in eFlora index" );
                }
                continue;
            }

            if ( taxon.getJepsonID() !== jepsInfo.id ) {
                if ( !Exceptions.hasException( name, "jepson", "badjepsonid" ) ) {
                    LogMessage.log( name, "Jepson ID does not match ID from eFlora index", taxon.getJepsonID(), jepsInfo.id );
                }
            }

            switch ( jepsInfo.category ) {
                case "JFP-1":
                case "JFP-7":
                case "JFP-10":
                    // Make sure we have it listed as a CA native.
                    if ( !taxon.isCANative() ) {
                        LogMessage.log( name, "Jepson eFlora index has category JFP-1 but taxa.csv says not native" );
                    }
                    break;
                case "JFP-1a":
                    if ( !Exceptions.hasException( name, "jepson", "allowsynonym" ) ) {
                        LogMessage.log( name, "is synonym in Jepson eFlora index" );
                    }
                    break;
                case "JFP-1b":
                    LogMessage.log( name, "is JFP-1b in Jepson eFlora index - invalid name" );
                    break;
                case "JFP-2":
                case "JFP-2_t":
                case "JFP-pending 2, accepted name for taxon naturalized in CA":
                case "JFP-3":
                case "JFP-4":
                    // Make sure we have it listed as not a CA native.
                    if ( taxon.isCANative() ) {
                        LogMessage.log( name, "Jepson eFlora index has category " + jepsInfo.category + " but taxa.csv says native" );
                    }
                    break;
                case "JFP-unresolved":
                    // Ignore for now.
                    break;
                case "JFP-11":
                case "JFP-11a":
                    LogMessage.log( name, "Jepson eFlora index has category " + jepsInfo.category + "; not taxonomically recognized" );
                    break;
                default:
                    throw new Error( name + " " + jepsInfo.category );
            }
        }

        this.#checkExceptions( Taxa );
    }

    static #checkExceptions( Taxa ) {

        // Check the Jepson exceptions and make sure they still apply.
        for ( const [ name, v ] of Exceptions.getExceptions() ) {
            const exceptions = v.jepson;
            if ( !exceptions ) {
                continue;
            }

            // Make sure the taxon is still in our list.
            const taxon = Taxa.getTaxon( name );
            if ( !taxon ) {
                LogMessage.log( name, "has Jepson exceptions but not in taxa.tsv" );
                continue;
            }

            for ( const [ k ] of Object.entries( exceptions ) ) {
                const jepsonData = this.#getJepsInfo( name );
                switch ( k ) {
                    case "allowsynonym": {
                        const category = jepsonData.category;
                        if ( category !== "JFP-1a" ) {
                            LogMessage.log( name, "has Jepson allowsynonym exception but is not a synonym" );
                        }
                        break;
                    }
                    case "badjepsonid": {
                        // Make sure Jepson ID is still wrong.
                        const cfID = jepsonData ? jepsonData.id : undefined;
                        const jepsID = taxon.getJepsonID();
                        if ( cfID === jepsID ) {
                            LogMessage.log( name, "has Jepson badjepsonid exception but IDs are the same" );
                        }
                        break;
                    }
                    case "notinnameindex":
                        if ( jepsonData ) {
                            LogMessage.log( name, "found in Jepson data but has notinnameindex exception" );
                        }
                        break;
                    default:
                        LogMessage.log( name, "unrecognized Jepson exception", k );
                }
            }
        }
    }

    static #getJepsInfo( name ) {
        // Hybrids are formatted differently in the index.
        name = name.replace( "×", "X " );
        return Jepson.#nameInfo[ name ];
    }
}

export { Jepson };