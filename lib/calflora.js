import * as fs from "node:fs";
import fetch from "node-fetch";
import { CSV } from "@ca-plant-list/ca-plant-list/CSV";
import { LogMessage } from "./logmessage.js";

const TOOLS_DATA_DIR = "./external_data";
const CALFLORA_URL = "https://www.calflora.org/app/downtext?xun=117493&table=species&format=Tab&cols=0,1,4,5,8,38,41,43&psp=lifeform::grass,Tree,Herb,Fern,Shrub,Vine!!&par=f&active=";

class Calflora {

    static #taxa = {};

    static async analyze( Taxa, retrieveToolData ) {

        function findCalfloraData( cfName ) {
            const data = Calflora.#taxa[ cfName ];
            if ( data ) {
                return data;
            }
            const parts = cfName.split( " " );
            switch ( parts.length ) {
                case 2: {
                    parts.push( "ssp." );
                    parts.push( parts[ 1 ] );
                    let data = findCalfloraData( parts.join( " " ) );
                    if ( data ) {
                        return data;
                    }
                    parts[ 2 ] = "var.";
                    return findCalfloraData( parts.join( " " ) );
                }

            }
        }

        const calfloraDataFileNameActive = "calflora_taxa_active.tsv";
        const calfloraDataFileNameInactive = "calflora_taxa_inactive.tsv";
        if ( retrieveToolData ) {
            console.log( "retrieving Calflora species" );
            await this.fetchToFile( CALFLORA_URL + "1", TOOLS_DATA_DIR + "/" + calfloraDataFileNameActive );
            await this.fetchToFile( CALFLORA_URL + "0", TOOLS_DATA_DIR + "/" + calfloraDataFileNameInactive );
        }

        const csvActive = CSV.parseFile( TOOLS_DATA_DIR, calfloraDataFileNameActive );
        const csvInactive = CSV.parseFile( TOOLS_DATA_DIR, calfloraDataFileNameInactive );

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
                LogMessage.log( name, "not found in Calflora files" );
                continue;
            }

            // Check native status.
            const cfNative = cfData[ "Native Status" ];
            const cfIsNative = cfNative === "rare" || cfNative === "native";
            if ( !cfIsNative ) {
                LogMessage.log( name, "is non-native in Calflora" );
            }

            // Check if it is active in Calflora.
            const isActive = cfData[ "Active in Calflora?" ];
            if ( isActive !== "YES" ) {
                LogMessage.log( name, "is not active in Calflora" );
            }

            // Check Jepson IDs.
            const cfJepsonID = cfData[ "TJMTID" ];
            if ( cfJepsonID !== taxon.getJepsonID() ) {
                LogMessage.log( name, "Jepson ID in Calflora is different than taxa_meta.csv", cfJepsonID, taxon.getJepsonID() );
            }

            // Check Calflora ID.
            const cfID = cfData[ "Calrecnum" ];
            if ( cfID !== taxon.getCalfloraID() ) {
                LogMessage.log( name, "Calflora ID in Calflora is different than taxa_meta.csv", cfID, taxon.getCalfloraID() );
            }
        }

    }

    static async fetchToFile( url, targetFileName ) {
        const response = await fetch( url );
        const data = await response.text();
        fs.writeFileSync( targetFileName, data );
    }

}

export { Calflora };