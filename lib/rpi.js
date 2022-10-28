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
            const taxon = Taxa.getTaxon( name );
            if ( !taxon ) {
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