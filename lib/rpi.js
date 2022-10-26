import { CSV } from "@ca-plant-list/ca-plant-list/CSV";
import { Exceptions } from "@ca-plant-list/ca-plant-list/Exceptions";
import { Taxa } from "@ca-plant-list/ca-plant-list/Taxa";
import { LogMessage } from "./logmessage.js";

class RPI {

    static analyze() {
        const fileName = "rpi.csv";
        const csv = CSV.parseFile( "./external_data", fileName );
        for ( const row of csv ) {
            const name = row[ "ScientificName" ].replace( " ssp.", " subsp." );
            const rank = row[ "CRPR" ];
            const is1A = rank.includes( "1A" );
            const taxon = Taxa.getTaxon( name );
            if ( !taxon ) {
                if ( !is1A && !Exceptions.hasException( name, "rpi", "notingeo" ) ) {
                    LogMessage.log( name, "in RPI but not found in taxa.csv", rank );
                }
                continue;
            }
            if ( is1A ) {
                LogMessage.log( name, "in taxa.csv but rank is 1A", rank );
                continue;
            }
            if ( rank !== taxon.getRankRPI() ) {
                LogMessage.log( name, "rank in taxa.csv is different than rank in " + fileName, taxon.getRankRPI(), rank );
            }
        }
    }

}

export { RPI };