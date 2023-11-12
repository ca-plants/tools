#!/usr/bin/env node

import * as path from "node:path";
import { CommandProcessor, Config, ErrorLog, Exceptions, TaxaLoader, TaxaProcessor } from "@ca-plant-list/ca-plant-list";
import { Calflora } from "../lib/calflora.js";
import { INat } from "../lib/inat.js";
import { JepsonEFlora } from "../lib/jepsoneflora.js";
import { JepsonFamilies } from "../lib/jepsonfamilies.js";
import { RPI } from "../lib/rpi.js";
import { SupplementalText } from "../lib/supplementaltext.js";

const TOOLS = {
    CALFLORA: "calflora",
    INAT: "inat",
    JEPSON_EFLORA: "jepson-eflora",
    JEPSON_FAM: "jepson-families",
    RPI: "rpi",
    TEXT: "text",
};

const ALL_TOOLS = [ TOOLS.CALFLORA, TOOLS.INAT, TOOLS.JEPSON_EFLORA, TOOLS.RPI, TOOLS.TEXT ];

const OPT_LOADER = "loader";
const OPT_TOOL = "tool";

const OPTION_DEFS = [
    { name: "in-taxafile", type: String, defaultValue: "inat_taxa.csv" },
    { name: "ef-lognotes", type: Boolean },
    { name: OPT_LOADER, type: String },
    { name: OPT_TOOL, type: String, multiple: true },
];

const OPTION_HELP = [
    {
        name: OPT_LOADER,
        type: String,
        typeLabel: "{underline path}",
        description: "The path (relative to the current directory) of the JavaScript file containing the TaxaLoader class."
            + " If not provided, the default TaxaLoader will be used."
    },
    {
        name: "tool",
        type: String,
        multiple: true,
        description: "The tools to run. Value may be {bold all} to run all tools, or any subset of the tools below."
    },
];

const ADDITIONAL_HELP = [
    {
        header: "Tools",
        content: [
            { tool: "all", desc: "Run the {bold calflora}, {bold inat}, {bold jepson-eflora}, {bold rpi}, and {bold text} tools." },
            { tool: TOOLS.CALFLORA, desc: "Retrieve data from Calflora and compare with local data." },
            { tool: TOOLS.INAT, desc: "Retrieve data from iNaturalist and compare with local data." },
            { tool: TOOLS.JEPSON_EFLORA, desc: "Retrieve data from Jepson eFlora indexes and compare with local data." },
            { tool: TOOLS.JEPSON_FAM, desc: "Retrieve section, family and genus data from Jepson eFlora and create data files for ca-plant-list." },
            { tool: TOOLS.RPI, desc: "Retrieve data from CNPS Rare Plant Inventory and compare with local data." },
            { tool: TOOLS.TEXT, desc: "Check supplemental text files to make sure their names are referenced." },
        ]
    },
    {
        header: "Tool Options",
        optionList: [
            {
                name: "ef-lognotes",
                type: Boolean,
                description: "Include eFlora notes, invalid names, etc. in the log file."
            },
            {
                name: "in-taxafile",
                type: String,
                typeLabel: "{underline filename}",
                description: "The name of the file containing the iNaturalist taxa. Can be used for testing on a smaller subset of the iNaturalist data. Defaults to {bold inat_taxa.csv}."
            },
        ]
    },

];

const TOOLS_DATA_DIR = "./external_data";

async function getLoader( options ) {
    const loader = options[ OPT_LOADER ];
    if ( !loader ) {
        return TaxaLoader;
    }
    const taxaLoaderClass = await import( "file:" + path.resolve( loader ) );
    return taxaLoaderClass.TaxaLoader;
}


async function runTools( taxaProcessor ) {

    const options = taxaProcessor.getOptions();
    const taxa = taxaProcessor.getTaxa();
    const exceptions = new Exceptions( options.datadir );
    const config = new Config( options.datadir );
    const errorLog = new ErrorLog( "./external_data/log.tsv", true );

    let tools = options[ OPT_TOOL ];
    if ( tools[ 0 ] === "all" ) {
        tools = ALL_TOOLS;
    }

    for ( const tool of tools ) {
        switch ( tool ) {
            case TOOLS.CALFLORA:
                await Calflora.analyze( TOOLS_DATA_DIR, taxa, exceptions, errorLog );
                break;
            case TOOLS.INAT:
                await INat.analyze( TOOLS_DATA_DIR, taxa, exceptions, errorLog, options[ "in-taxafile" ] );
                break;
            case TOOLS.JEPSON_EFLORA: {
                const eflora = new JepsonEFlora( TOOLS_DATA_DIR, taxa, errorLog, options[ "ef-lognotes" ] );
                await eflora.analyze( exceptions );
                break;
            }
            case TOOLS.JEPSON_FAM:
                await JepsonFamilies.build( TOOLS_DATA_DIR );
                break;
            case TOOLS.RPI:
                await RPI.analyze( TOOLS_DATA_DIR, taxa, config, exceptions, errorLog );
                break;
            case TOOLS.TEXT:
                SupplementalText.analyze( taxa, errorLog );
                break;
            default:
                console.log( "unrecognized tool: " + tool );
                return;
        }
    }

    errorLog.write();
}

const c = new CommandProcessor(
    "ca-plant-tools",
    "Tools to compare plant lists with online plant data.",
    OPTION_DEFS,
    OPTION_HELP,
    ADDITIONAL_HELP
);
const options = c.getOptions();

// If no tools were selected, show help.
if ( !options[ OPT_TOOL ] ) {
    c.showHelp();
}

if ( !c.helpShown() ) {
    const t = new TaxaProcessor( options, await getLoader( options ) );
    await t.process( runTools );
}