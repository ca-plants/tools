import { Files } from "@ca-plant-list/ca-plant-list";
import { HTMLTree } from "./htmltree.js";

const TYPES = {
    EX_ALIEN: "Extirpated alien",
    HYBRID_SPONT: "Spontaneous hybrid",
    ILLEGITIMATE: "Illegitimate name",
    INVALID: "Invalid name",
    INVALID_NOTED: "Noted name", // "auct. non" = misapplied name
    INVALID_SUPERFLUOUS: "Superfluous name",
    MENTIONED: "Mentioned in a note",
    MISAPPLIED: "Misapplied name",
    MISAPP_PART: "Misapplied name, in part",
    MISAPP_UNABRIDGED: "Unabridged misapplied name",
    NATIVE: "Native",
    NATIVITY_UNCERTAIN: "Native or naturalized",
    NATURALIZED: "Naturalized",
    POSSIBLY_IN_CA: "Possibly in ca",
    SYNONYM: "Synonym",
    SYN_INED: "Synonym ined.", //nomen ineditum, unpublished name; name not published or not validly published
    SYN_ORTH_VARIANT: "Orthographic variant",
    SYN_PART: "Synonym, in part",
    SYN_PART_UN: "Unabridged synonym, in part",
    WAIF: "Waif",
    WAIF_EX: "Extirpated waif",
    WAIF_HIST: "Historical waif",
    WEED: "* weed*",
};

class JepsonEFlora {

    #toolsDataPath;
    #taxa;
    #errorLog;
    #shouldLogNotes;

    #nameInfo = {};
    #loadedLetters = {};

    constructor( toolsDataDir, taxa, errorLog, shouldLogNotes ) {
        this.#toolsDataPath = toolsDataDir + "/jepson-eflora";
        this.#taxa = taxa;
        this.#errorLog = errorLog;
        this.#shouldLogNotes = shouldLogNotes;
    }

    async analyze( exceptions ) {

        // Create data directory if it's not there.
        Files.mkdir( this.#toolsDataPath );

        for ( const taxon of this.#taxa.getTaxonList() ) {

            const name = taxon.getName();
            if ( name.includes( " unknown" ) ) {
                continue;
            }

            const jepsInfo = await this.#getJepsInfo( name );
            if ( jepsInfo === undefined ) {
                // Not found in the index.
                if ( !exceptions.hasException( name, "jepson", "notineflora" ) ) {
                    this.#errorLog.log( name, "not found in eFlora index" );
                }
                continue;
            }

            if ( taxon.getJepsonID() !== jepsInfo.id ) {
                this.#errorLog.log( name, "Jepson ID does not match ID from eFlora index", taxon.getJepsonID(), jepsInfo.id );
            }

            if ( this.#isSynonym( jepsInfo ) ) {
                if ( !exceptions.hasException( name, "jepson", "allowsynonym" ) ) {
                    this.#errorLog.log( name, "is synonym for", jepsInfo.under );
                }
            }

            const efStatus = this.#getStatusCode( jepsInfo );
            const taxonStatus = taxon.getStatus();
            if ( efStatus !== taxonStatus && !( taxonStatus === "NC" && efStatus === "N" ) ) {
                this.#errorLog.log( name, "Jepson eFlora index has different nativity status than taxa.csv", efStatus, taxonStatus );
            }

        }

        await this.#checkSynonyms();
        this.#checkExceptions( exceptions );
    }

    #checkExceptions( exceptions ) {

        // Check the Jepson exceptions and make sure they still apply.
        for ( const [ name, v ] of exceptions.getExceptions() ) {
            const exceptions = v.jepson;
            if ( !exceptions ) {
                continue;
            }

            // Make sure the taxon is still in our list.
            const taxon = this.#taxa.getTaxon( name );
            if ( !taxon ) {
                this.#errorLog.log( name, "has Jepson exceptions but is not in taxa.tsv" );
                continue;
            }

            for ( const [ k ] of Object.entries( exceptions ) ) {
                const jepsonData = this.#nameInfo[ name ];
                switch ( k ) {
                    case "allowsynonym":
                        // Make sure it really is a synonym.
                        if ( !this.#isSynonym( jepsonData ) ) {
                            this.#errorLog.log( name, "has Jepson allowsynonym exception but is not a synonym" );
                        }
                        break;
                    case "notineflora":
                        // Make sure it is really not in eFlora.
                        if ( jepsonData ) {
                            this.#errorLog.log( name, "has Jepson notineflora exception but is in eFlora" );
                        }
                        break;
                    default:
                        this.#errorLog.log( name, "unrecognized Jepson exception", k );
                }
            }
        }
    }

    async #checkSynonyms() {
        // Make sure all synonyms in eFlora are in our list.
        for ( const jepsonInfo of Object.values( this.#nameInfo ) ) {
            if ( !this.#isSynonym( jepsonInfo ) ) {
                continue;
            }

            const target = jepsonInfo.under;
            const taxon = this.#taxa.getTaxon( target );
            if ( !taxon ) {
                // We're not tracking the target.
                continue;
            }

            if ( taxon.getSynonyms().includes( jepsonInfo.name ) ) {
                // Already have it.
                continue;
            }

            this.#errorLog.log( target, "does not have synonym", jepsonInfo.name + "," + target );
        }

        // Make sure everything in our list is in eFlora.
        for ( const taxon of this.#taxa.getTaxonList() ) {
            for ( const synonym of taxon.getSynonyms() ) {
                const jepsonInfo = await this.#getJepsInfo( synonym );
                if ( !jepsonInfo || !this.#isSynonym( jepsonInfo ) ) {
                    // Ignore iNat synonyms.
                    if ( synonym !== taxon.getINatSyn() ) {
                        this.#errorLog.log( synonym, "is in synonyms.csv but is not a synonym in eFlora" );
                    }

                }
            }
        }

    }

    async #getJepsInfo( name ) {
        const firstLetter = name[ 0 ];
        // See if this index has been loaded.
        if ( !this.#loadedLetters[ firstLetter ] ) {
            await this.#loadNameIndex( firstLetter, this.#toolsDataPath );
        }

        return this.#nameInfo[ name ];
    }

    #getStatusCode( jepsInfo ) {
        // If it's a synonym, return status of the target.
        if ( this.#isSynonym( jepsInfo ) ) {
            const targetInfo = this.#nameInfo[ jepsInfo.under ];
            if ( !targetInfo ) {
                return;
            }
            return this.#getStatusCode( targetInfo );
        }
        switch ( jepsInfo.type ) {
            case TYPES.NATIVE:
                return "N";
            case TYPES.NATIVITY_UNCERTAIN:
                return "U";
            default:
                return "X";
        }
    }

    #isSynonym( jepsInfo ) {
        switch ( jepsInfo.type ) {
            case TYPES.SYNONYM:
                return true;
        }
        return false;
    }

    async #loadNameIndex( firstLetter ) {

        async function retrieveIfNotFound( url, targetFile ) {
            // Retrieve file if it's not there.
            if ( Files.exists( targetFile ) ) {
                return;
            }
            console.log( "retrieving " + targetFile );
            await Files.fetch( url, targetFile );
        }

        const fileName = "index_" + firstLetter + ".html";
        const filePath = this.#toolsDataPath + "/" + fileName;
        const url = "https://ucjeps.berkeley.edu/eflora/eflora_index.php?index=" + firstLetter;

        await retrieveIfNotFound( url, filePath );

        const document = HTMLTree.getTreeFromFile( filePath );
        this.#parseIndex( document );

        this.#loadedLetters[ firstLetter ] = true;
    }

    #logNotes( taxonData ) {
        // If we're tracking the source, log it.
        if ( this.#taxa.getTaxon( taxonData.name ) ) {
            this.#errorLog.log( taxonData.name, "has eFlora note (as source)", taxonData.type + " for", taxonData.under );
        }
        // If we're tracking the target, log it.
        if ( this.#taxa.getTaxon( taxonData.under ) ) {
            this.#errorLog.log( taxonData.under, "has eFlora note (as target)", taxonData.type + " for", taxonData.name );
        }
    }

    #parseIndex( docTree ) {

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

            // If we're not tracking either the source or target, ignore this entry.
            if ( !this.#taxa.getTaxon( taxonData.name ) && !this.#taxa.getTaxon( taxonData.under ) ) {
                continue;
            }

            switch ( type ) {
                case TYPES.ILLEGITIMATE:
                case TYPES.INVALID:
                case TYPES.INVALID_NOTED:
                case TYPES.INVALID_SUPERFLUOUS:
                case TYPES.MISAPPLIED:
                case TYPES.MISAPP_PART:
                case TYPES.MISAPP_UNABRIDGED:
                case TYPES.SYN_INED:
                case TYPES.SYN_ORTH_VARIANT:
                case TYPES.SYN_PART:
                case TYPES.SYN_PART_UN:
                case TYPES.MENTIONED:
                    // Not a valid synonym or active taxon. Log it for further investigation.
                    if ( this.#shouldLogNotes ) {
                        this.#logNotes( taxonData );
                    }
                    continue;
            }

            if ( this.#nameInfo[ taxonData.name ] ) {
                this.#errorLog.log( taxonData.name, "has multiple entries in eFlora" );
                // Disable the current entry, since we don't know which one is correct.
                this.#nameInfo[ taxonData.name ] = {};
                continue;
            }
            this.#nameInfo[ taxonData.name ] = taxonData;
        }

    }

}

export { JepsonEFlora };