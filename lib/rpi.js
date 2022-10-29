import { CSV } from "@ca-plant-list/ca-plant-list/CSV";
import { Exceptions } from "@ca-plant-list/ca-plant-list/Exceptions";
import { Taxa } from "@ca-plant-list/ca-plant-list/Taxa";
import { LogMessage } from "./logmessage.js";

class RPI {

    static analyze() {
        const fileName = "rpi.csv";
        const csv = CSV.parseFile( "./external_data", fileName );
        for ( const row of csv ) {
            const rpiName = row[ "ScientificName" ].replace( " ssp.", " subsp." );
            const translatedName = Exceptions.getValue( rpiName, "rpi", "translation" );
            const name = translatedName ? translatedName : rpiName;
            const rank = row[ "CRPR" ];
            const rawCESA = row[ "CESA" ];
            const cesa = ( rawCESA === "None" ) ? undefined : rawCESA;
            const taxon = Taxa.getTaxon( name );
            if ( !taxon ) {
                if ( cesa ) {
                    LogMessage.log( name, "is CESA listed but not found in taxa.csv", cesa );
                }
                if ( this.#hasExceptions( name, "nojepson", "notingeo" ) ) {
                    continue;
                }
                if ( this.#hasExceptions( name, "extirpated" ) && ( rank === "1A" || rank === "2A" ) ) {
                    continue;
                }
                LogMessage.log( name, "in RPI but not found in taxa.csv", rank );
                continue;
            }
            if ( rank !== taxon.getRPIRankAndThreat() ) {
                if ( !this.#hasExceptions( name, "non-native" ) ) {
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

}

export { RPI };