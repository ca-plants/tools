#!/usr/bin/env node

import { RPI } from "./rpi.js";
import commandLineArgs from "command-line-args";
import { INat } from "./inat.js";
import { LogMessage } from "./logmessage.js";

const OPTION_DEFS = [
    { name: "data", type: String, defaultValue: "./data" },
    { name: "data-inat-taxa", type: String, defaultValue: "inat_taxa.csv" },
    { name: "tool", type: String },
];

class Tools {

    static #options = commandLineArgs( OPTION_DEFS );

    static getOptions() {
        return this.#options;
    }

    static async run( Taxa ) {

        switch ( this.#options.tool ) {
            case "inat":
                await INat.analyze( this.#options[ "data-inat-taxa" ], Taxa );
                break;
            case "rpi":
                RPI.analyze();
                break;
            default:
                throw new Error( "unrecognized tool: " + this.#options.data );
        }

        LogMessage.write( "./external_data/log.tsv" );
    }

}

export { Tools };