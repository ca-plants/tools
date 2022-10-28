#!/usr/bin/env node

import { RPI } from "./lib/rpi.js";
import commandLineArgs from "command-line-args";
import { DataLoader } from "@ca-plant-list/ca-plant-list/DataLoader";

const OPTION_DEFS = [
    { name: "tool", type: String },
];

const options = commandLineArgs( OPTION_DEFS );

DataLoader.load( "./data" );

switch ( options.tool ) {
    case "rpi":
        RPI.analyze();
        break;
}