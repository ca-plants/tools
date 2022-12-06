import { CSV } from "@ca-plant-list/ca-plant-list";
import { Files } from "@ca-plant-list/ca-plant-list";
import { Exceptions } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

const CALFLORA_URL = "https://www.calflora.org/app/downtext?xun=117493&table=species&format=Tab&cols=0,1,4,5,8,38,41,43&psp=lifeform::grass,Tree,Herb,Fern,Shrub,Vine!!&par=f&active=";

class Calflora {

    static #taxa = {};

    static async analyze( toolsDataDir, Taxa, retrieveToolData ) {

        function findCalfloraData( cfName ) {
            return Calflora.#taxa[ cfName ];
        }

        const calfloraDataFileNameActive = "calflora_taxa_active.tsv";
        const calfloraDataFileNameInactive = "calflora_taxa_inactive.tsv";
        if ( retrieveToolData ) {
            console.log( "retrieving Calflora species" );
            await Files.fetch( CALFLORA_URL + "1", toolsDataDir + "/" + calfloraDataFileNameActive );
            await Files.fetch( CALFLORA_URL + "0", toolsDataDir + "/" + calfloraDataFileNameInactive );
        }

        const csvActive = CSV.parseFile( toolsDataDir, calfloraDataFileNameActive );
        const csvInactive = CSV.parseFile( toolsDataDir, calfloraDataFileNameInactive );

        for ( const row of csvActive ) {
            this.#taxa[ row[ "Taxon" ] ] = row;
        }
        for ( const row of csvInactive ) {
            const name = row[ "Taxon" ];
            if ( this.#taxa[ name ] ) {
                LogMessage.log( name, "is in both active and inactive Calflora files" );
            }
            this.#taxa[ name ] = row;
        }

        for ( const taxon of Taxa.getTaxa() ) {
            const name = taxon.getName();
            if ( name.includes( " unknown" ) ) {
                continue;
            }
            const cfName = taxon.getCalfloraName();
            const cfData = findCalfloraData( cfName );
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
                LogMessage.log( name, "is not active in Calflora" );
            }

            // Check Jepson IDs.
            const cfJepsonID = cfData[ "TJMTID" ];
            if ( cfJepsonID !== taxon.getJepsonID() ) {
                if ( !Exceptions.hasException( name, "calflora", "badjepsonid" ) ) {
                    LogMessage.log( name, "Jepson ID in Calflora is different than taxa_meta.csv", cfJepsonID, taxon.getJepsonID() );
                }
            }

            // Check Calflora ID.
            const cfID = cfData[ "Calrecnum" ];
            if ( cfID !== taxon.getCalfloraID() ) {
                LogMessage.log( name, "Calflora ID in Calflora is different than taxa_meta.csv", cfID, taxon.getCalfloraID() );
            }
        }

    }

}

export { Calflora };