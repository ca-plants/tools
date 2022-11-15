import { CSV } from "@ca-plant-list/ca-plant-list";
import { Files } from "@ca-plant-list/ca-plant-list";
import { Exceptions } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

class RPI {

    static analyze( Taxa ) {
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

    static async scrape( Taxa, retrieveToolData ) {

        const fileName = "rpi.html";
        const filePath = "./external_data/" + fileName;

        if ( retrieveToolData ) {
            const url = "https://rareplants.cnps.org/Search/result?frm=T&life=tree:herb:shrub:vine:leaf:stem";
            console.log( "retrieving " + url );
            await Files.fetch( url, filePath );
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
            const translatedName = Exceptions.getValue( name, "rpi", "translate", name );
            const id = rpiIDs[ translatedName ];
            if ( !id ) {
                LogMessage.log( name, "not found in RPI HTML", translatedName );
            }
            if ( id !== taxon.getRPIID() ) {
                LogMessage.log( name, "RPI ID in " + fileName + " does not match site data", id, taxon.getRPIID() );
            }
        }
    }

}

export { RPI };