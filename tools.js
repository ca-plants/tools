#!/usr/bin/env node

import { RPI } from "./lib/rpi.js";
import commandLineArgs from "command-line-args";
import { DataLoader } from "@ca-plant-list/ca-plant-list/DataLoader";
import { INat } from "./lib/inat.js";
import { LogMessage } from "./lib/logmessage.js";

const OPTION_DEFS = [
    { name: "data", type: String, defaultValue: "./data" },
    { name: "data-inat-taxa", type: String, defaultValue: "inat_taxa.csv" },
    { name: "tool", type: String },
];

const options = commandLineArgs( OPTION_DEFS );

DataLoader.load( options.data );

switch ( options.tool ) {
    case "inat":
        await INat.analyze( options[ "data-inat-taxa" ] );
        break;
    case "rpi":
        RPI.analyze();
        break;
}

LogMessage.write( "./external_data/log.tsv" );