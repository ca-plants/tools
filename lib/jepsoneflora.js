import { Exceptions, Files } from "@ca-plant-list/ca-plant-list";
import { HTMLTree } from "./htmltree.js";
import { LogMessage } from "./logmessage.js";

const TYPES = {
    EX_ALIEN: "Extirpated alien",
    HYBRID_SPONT: "Spontaneous hybrid",
    ILLEGITIMATE: "Illegitimate name",
    INVALID: "Invalid name",
    MENTIONED: "Mentioned in a note",
    MISAPPLIED: "Misapplied name",
    MISAPP_PART: "Misapplied name, in part",
    NATIVE: "Native",
    NATIVITY_UNCERTAIN: "Native or naturalized",
    NATURALIZED: "Naturalized",
    NOTED: "Noted name",
    ORTH_VARIANT: "Orthographic variant",
    POSSIBLY_IN_CA: "Possibly in ca",
    SUPERFLUOUS: "Superfluous name",
    SYNONYM: "Synonym",
    SYN_INED: "Synonym ined.",
    SYN_PART: "Synonym, in part",
    SYN_PART_UN: "Unabridged synonym, in part",
    UNABRIDGED: "Unabridged misapplied name",
    WAIF: "Waif",
    WAIF_EX: "Extirpated waif",
    WAIF_HIST: "Historical waif",
    WEED: "* weed*",
};

class JepsonEFlora {

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

            const fileName = "index_" + firstLetter + ".html";
            const filePath = toolsDataPath + "/" + fileName;
            const url = "https://ucjeps.berkeley.edu/eflora/eflora_index.php?index=" + firstLetter;

            await retrieveIfNotFound( url, filePath );

            const document = HTMLTree.getTreeFromFile( filePath );
            JepsonEFlora.#parseIndex( document );

            JepsonEFlora.#loadedLetters[ firstLetter ] = true;
        }

        async function getJepsInfo( name ) {
            const firstLetter = name[ 0 ];
            // See if this index has been loaded.
            if ( !JepsonEFlora.#loadedLetters[ firstLetter ] ) {
                await loadNameIndex( firstLetter );
            }

            return JepsonEFlora.#nameInfo[ name ];
        }

        const toolsDataPath = toolsDataDir + "/jepson-eflora";

        // Create data directory if it's not there.
        Files.mkdir( toolsDataPath );

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
                // if ( !Exceptions.hasException( name, "jepson", "badjepsonid" ) ) {
                LogMessage.log( name, "Jepson ID does not match ID from eFlora index", taxon.getJepsonID(), jepsInfo.id );
                // }
            }

            const efStatus = this.#getStatusCode( jepsInfo.type );
            const taxonStatus = taxon.getStatus();
            if ( efStatus !== taxonStatus && !( taxonStatus === "NC" && efStatus === "N" ) ) {
                LogMessage.log( name, "Jepson eFlora index has different type than taxa.csv", efStatus, taxonStatus );
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

            for ( const [ k, v ] of Object.entries( exceptions ) ) {
                const jepsonData = this.#nameInfo[ name ];
                // switch ( k ) {
                //     case "allowsynonym": {
                //         const category = jepsonData.category;
                //         if ( category !== "JFP-1a" ) {
                //             LogMessage.log( name, "has Jepson allowsynonym exception but is not a synonym" );
                //         }
                //         break;
                //     }
                //     case "badjepsonid": {
                //         // Make sure Jepson ID is still wrong.
                //         const id = jepsonData ? jepsonData.id : undefined;
                //         const jepsID = taxon.getJepsonID();
                //         if ( id === jepsID ) {
                //             LogMessage.log( name, "has Jepson badjepsonid exception but IDs are the same" );
                //         }
                //         break;
                //     }
                //     case "ignoreunrecognized":
                //         if ( jepsonData.category !== v ) {
                //             LogMessage.log( name, "ignoreunrecognized category in exception does nat match Jepson data", v, jepsonData.category );
                //         }
                //         break;
                //     case "notinnameindex":
                //         if ( jepsonData ) {
                //             LogMessage.log( name, "found in Jepson data but has notinnameindex exception" );
                //         }
                //         break;
                //     default:
                //         LogMessage.log( name, "unrecognized Jepson exception", k );
                // }
            }
        }
    }

    static #parseIndex( docTree ) {

        const validTypes = Object.values( TYPES );
        const reUnder = /\(Under (.*)\)/;

        const contentDiv = HTMLTree.getSubTree( docTree, t => HTMLTree.getAttr( t, "class" ) === "eFloraTable" );
        const rows = HTMLTree.getSubTrees( contentDiv, t => t.tagName === "tr" );

        for ( const row of rows ) {

            const cols = HTMLTree.getSubTrees( row, t => t.tagName === "td" );
            if ( !cols || cols.length < 3 ) {
                continue;
            }

            const links = HTMLTree.getSubTrees( cols[ 0 ], t => t.tagName === "a" );
            // Should be at least one link for a species row.
            if ( !links || links.length === 0 ) {
                continue;
            }

            let type = HTMLTree.getTextContent( cols[ 2 ] );
            if ( !type ) {
                // Some species are lacking a type; if it's one we're tracking, errors will show elsewhere, so ignore for now.
                continue;
            }

            const linkData = HTMLTree.getLinkData( links[ 0 ] );
            if ( !linkData.text.includes( " " ) ) {
                // It's a genus name, ignore it.
                continue;
            }

            if ( type.includes( " weed" ) ) {
                type = TYPES.WEED;
            }
            if ( !validTypes.includes( type ) ) {
                throw new Error( "unrecognized type for " + linkData.text + ": " + type );
            }

            const text = HTMLTree.getSubTrees( cols[ 0 ], t => t.nodeName === "#text" );
            const under = HTMLTree.getTextContent( text[ 1 ] );
            const common = HTMLTree.getTextContent( cols[ 1 ] );

            const taxonData = {};

            taxonData.name = linkData.text;
            taxonData.id = linkData.href.split( "=" )[ 1 ];
            taxonData.type = type;
            if ( taxonData.common ) {
                taxonData.common = common;
            }

            if ( under ) {
                const m = under.match( reUnder );
                if ( m ) {
                    taxonData.under = m[ 1 ];
                }
            }

            if ( this.#nameInfo[ taxonData.name ] ) {
                // Already there; assume the first one is the main entry.
                continue;
            }
            this.#nameInfo[ taxonData.name ] = taxonData;
        }

    }

    static #getStatusCode( type ) {
        switch ( type ) {
            case TYPES.NATIVE:
                return "N";
            case TYPES.NATIVITY_UNCERTAIN:
                return "U";
            default:
                return "X";
        }
    }

}

export { JepsonEFlora };