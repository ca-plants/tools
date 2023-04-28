import { CSV, Exceptions, Files } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

const CALFLORA_URL_ALL = "https://www.calflora.org/app/downtext?xun=117493&table=species&format=Tab&cols=0,1,4,5,8,38,41,43&psp=lifeform::grass,Tree,Herb,Fern,Shrub,Vine!!&par=f&active=";
const CALFLORA_URL_COUNTY = "https://www.calflora.org/app/downtext?xun=117493&table=species&format=Tab&cols=0,1,4,5,8,38,41,43&psp=countylist::ALA,CCA!!&active=1";

const COL_JEPSON_ID = "TJMTID";

class Calflora {

    static #taxa = {};

    static async analyze( toolsDataDir, Taxa ) {

        async function retrieveCalfloraFile( url, targetFile ) {
            // Retrieve file if it's not there.
            targetFile = toolsDataPath + "/" + targetFile;
            if ( Files.exists( targetFile ) ) {
                return;
            }
            console.log( "retrieving " + targetFile );
            await Files.fetch( url, targetFile );
        }

        const toolsDataPath = toolsDataDir + "/calflora";
        // Create data directory if it's not there.
        Files.mkdir( toolsDataPath );

        const calfloraDataFileNameActive = "calflora_taxa_active.tsv";
        const calfloraDataFileNameCounties = "calflora_taxa_counties.tsv";

        await retrieveCalfloraFile( CALFLORA_URL_ALL + "1", calfloraDataFileNameActive );
        // County list and "all" lists are both incomplete; load everything to get as much as possible.
        await retrieveCalfloraFile( CALFLORA_URL_COUNTY, calfloraDataFileNameCounties );

        const csvActive = CSV.parseFile( toolsDataPath, calfloraDataFileNameActive );
        const csvCounties = CSV.parseFile( toolsDataPath, calfloraDataFileNameCounties );

        for ( const row of csvActive ) {
            this.#taxa[ row[ "Taxon" ] ] = row;
        }
        for ( const row of csvCounties ) {
            this.#taxa[ row[ "Taxon" ] ] = row;
        }

        for ( const taxon of Taxa.getTaxa() ) {
            const name = taxon.getName();
            if ( name.includes( " unknown" ) ) {
                continue;
            }
            const cfName = taxon.getCalfloraName();
            const cfData = Calflora.#taxa[ cfName ];
            if ( !cfData ) {
                if ( !Exceptions.hasException( name, "calflora", "notintaxondata" ) ) {
                    LogMessage.log( name, "not found in Calflora files" );
                }
                continue;
            }

            // Check native status.
            const cfNative = cfData[ "Native Status" ];
            const cfIsNative = ( cfNative === "rare" || cfNative === "native" );
            if ( cfIsNative !== taxon.isCANative() ) {
                LogMessage.log( name, "has different nativity status in Calflora", cfIsNative );
            }

            // Check if it is active in Calflora.
            const isActive = cfData[ "Active in Calflora?" ];
            if ( isActive !== "YES" ) {
                LogMessage.log( name, "is not active in Calflora", isActive );
            }

            // Check Jepson IDs.
            const cfJepsonID = cfData[ COL_JEPSON_ID ];
            if ( cfJepsonID !== taxon.getJepsonID() ) {
                if ( !Exceptions.hasException( name, "calflora", "badjepsonid" ) && !Exceptions.hasException( name, "calflora", "notintaxondata" ) ) {
                    LogMessage.log( name, "Jepson ID in Calflora is different than taxa_meta.csv", cfJepsonID, taxon.getJepsonID() );
                }
            }

            // Check Calflora ID.
            const cfID = cfData[ "Calrecnum" ];
            if ( cfID !== taxon.getCalfloraID() ) {
                LogMessage.log( name, "Calflora ID in Calflora is different than taxa_meta.csv", cfID, taxon.getCalfloraID() );
            }
        }

        this.#checkExceptions( Taxa );

    }

    static #checkExceptions( Taxa ) {
        // Check the Calflora exceptions and make sure they still apply.
        for ( const [ name, v ] of Exceptions.getExceptions() ) {
            const exceptions = v.calflora;
            if ( !exceptions ) {
                continue;
            }

            // Make sure the taxon is still in our list.
            const taxon = Taxa.getTaxon( name );
            if ( !taxon ) {
                LogMessage.log( name, "has Calflora exceptions but not in Taxa collection" );
                continue;
            }

            for ( const [ k ] of Object.entries( exceptions ) ) {
                const cfData = Calflora.#taxa[ name ];
                switch ( k ) {
                    case "notintaxondata":
                        if ( cfData ) {
                            LogMessage.log( name, "found in Calflora data but has notintaxondata exception" );
                        }
                        break;
                    case "badjepsonid": {
                        // Make sure Jepson ID is still wrong.
                        const cfID = cfData[ COL_JEPSON_ID ];
                        const jepsID = taxon.getJepsonID();
                        if ( cfID === jepsID ) {
                            LogMessage.log( name, "has Calflora badjepsonid exception but IDs are the same" );
                        }
                        break;
                    }
                    default:
                        LogMessage.log( name, "unrecognized Calflora exception", k );
                }
            }
        }
    }

}

export { Calflora };