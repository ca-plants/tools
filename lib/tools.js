#!/usr/bin/env node

import { RPI } from "./rpi.js";
import { INat } from "./inat.js";
import { LogMessage } from "./logmessage.js";

const OPTION_DEFS = [
    { name: "data", type: String, defaultValue: "./data" },
    { name: "data-inat-taxa", type: String, defaultValue: "inat_taxa.csv" },
    { name: "tool", type: String },
];

class Tools {

    static async run( options, Taxa ) {

        switch ( options.tool ) {
            case "inat":
                await INat.analyze( options[ "data-inat-taxa" ], Taxa );
                break;
            case "rpi":
                RPI.analyze();
                break;
            default:
                throw new Error( "unrecognized tool: " + options.data );
        }

        LogMessage.write( "./external_data/log.tsv" );
    }

    static getOptionDefs() {
        return OPTION_DEFS;
    }

}

export { Tools };