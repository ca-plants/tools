import { CSV } from "@ca-plant-list/ca-plant-list/CSV";
import { Taxa } from "@ca-plant-list/ca-plant-list/Taxa";
import { LogMessage } from "./logmessage.js";

class INat {

    static #taxa = {};

    static async analyze( fileName ) {
        await CSV.parseStream( "./external_data", fileName, undefined, undefined, this.#checkTaxon );
        console.log( "iNat: " + Object.keys( this.#taxa ).length + " taxa loaded" );

        for ( const taxon of Taxa.getTaxa() ) {
            const iNatName = taxon.getINatName();
            const iNatTaxon = this.#taxa[ iNatName ];
            if ( !iNatTaxon ) {
                LogMessage.log( taxon.getName(), "not found in " + fileName );
                continue;
            }
            if ( iNatTaxon.getID() !== taxon.getINatID() ) {
                LogMessage.log(
                    taxon.getName(),
                    "iNat ID in " + fileName + " does not match ID in taxa.csv",
                    iNatTaxon.getID(),
                    taxon.getINatID()
                );
            }
        }
    }

    static #checkTaxon( record ) {
        if ( record[ "phylum" ] === "Tracheophyta" && record[ "specificEpithet" ] ) {
            const name = record[ "scientificName" ];
            INat.#taxa[ name ] = new InetTaxon( record[ "id" ], name );
        }
    }


}

class InetTaxon {

    #id;
    #name;

    constructor( id, name ) {
        this.#id = id;
        this.#name = name;
    }

    getID() {
        return this.#id;
    }
}

export { INat };