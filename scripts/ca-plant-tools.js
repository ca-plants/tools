#!/usr/bin/env node

import { DataLoader, Taxa } from "@ca-plant-list/ca-plant-list";
import { Tools } from "../lib/tools.js";

const options = Tools.getCommandLineOptions( DataLoader.getOptionDefs() );

await DataLoader.load( options );

Tools.run( options, Taxa );