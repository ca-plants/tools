import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import { RPI } from "./rpi.js";
import { INat } from "./inat.js";
import { INatObs } from "./inatobs.js";
import { LogMessage } from "./logmessage.js";
import { Calflora } from "./calflora.js";
import { JepsonFamilies } from "./jepsonfamilies.js";
import { JepsonEFlora } from "./jepsoneflora.js";

const TOOLS = {
    CALFLORA: "calflora",
    INAT: "inat",
    INAT_OBS: "inat-obs",
    JEPSON_EFLORA: "jepson-eflora",
    JEPSON_FAM: "jepson-families",
    RPI: "rpi",
    RPI_SCRAPE: "rpi-scrape",
};

const ALL_TOOLS = [ TOOLS.CALFLORA, TOOLS.INAT, TOOLS.JEPSON_EFLORA, TOOLS.RPI, TOOLS.RPI_SCRAPE ];

const OPTION_DEFS = [
    { name: "data", type: String, defaultValue: "./data" },
    { name: "in-taxafile", type: String, defaultValue: "inat_taxa.csv" },
    { name: "ef-lognotes", type: Boolean },
    { name: "help", type: Boolean },
    { name: "tool", type: String, multiple: true },
];

const HELP = [
    {
        header: "tools.js",
        content: "Tools to compare plant lists with online plant data."
    },
    {
        header: "Options",
        optionList: [
            {
                name: "data",
                type: String,
                typeLabel: "{underline path}",
                description: "The directory in which the data files for the local plant list are located. Defaults to {bold ./data}."
            },
            {
                name: "help",
                type: Boolean,
                description: "Print this usage guide."
            },
            {
                name: "tool",
                type: String,
                multiple: true,
                description: "The tools to run. Value may be {bold all} to run all tools, or any subset of the tools below."
            },

        ]
    },
    {
        header: "Tools",
        content: [
            { tool: TOOLS.CALFLORA, desc: "Retrieve data from Calflora and compare with local data." },
            { tool: TOOLS.INAT, desc: "Retrieve data from iNaturalist and compare with local data." },
            { tool: TOOLS.JEPSON_EFLORA, desc: "Retrieve data from Jepson eFlora indexes and compare with local data." },
            { tool: TOOLS.JEPSON_FAM, desc: "Retrieve section, family and genus data from Jepson eFlora and create data files for ca-plant-list." },
            { tool: TOOLS.RPI, desc: "Retrieve data from CNPS Rare Plant Inventory and compare with local data." },
            { tool: TOOLS.RPI_SCRAPE, desc: "Retrieve IDs from CNPS Rare Plant Inventory and compare with local data." },
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

class Tools {

    static getCommandLineOptions( optionDefs ) {
        return commandLineArgs( optionDefs.concat( OPTION_DEFS ) );
    }

    static async run( options, Taxa ) {

        if ( options.help || options.tool === undefined ) {
            console.log( commandLineUsage( HELP ) );
            return;
        }

        let tools = options.tool;
        if ( tools[ 0 ] === "all" ) {
            tools = ALL_TOOLS;
        }

        for ( const tool of tools ) {
            switch ( tool ) {
                case TOOLS.CALFLORA:
                    await Calflora.analyze( TOOLS_DATA_DIR, Taxa );
                    break;
                case TOOLS.INAT:
                    await INat.analyze( TOOLS_DATA_DIR, Taxa, options[ "in-taxafile" ] );
                    break;
                case TOOLS.INAT_OBS:
                    await INatObs.retrieve( TOOLS_DATA_DIR );
                    break;
                case TOOLS.JEPSON_EFLORA:
                    await JepsonEFlora.analyze( TOOLS_DATA_DIR, Taxa, options[ "ef-lognotes" ] );
                    break;
                case TOOLS.JEPSON_FAM:
                    await JepsonFamilies.build( TOOLS_DATA_DIR );
                    break;
                case TOOLS.RPI:
                    await RPI.analyze( TOOLS_DATA_DIR, Taxa );
                    break;
                case TOOLS.RPI_SCRAPE:
                    await RPI.scrape( TOOLS_DATA_DIR, Taxa );
                    break;
                default:
                    console.log( "unrecognized tool: " + tool );
                    return;
            }
        }

        LogMessage.write( "./external_data/log.tsv" );
    }

}

export { Tools };