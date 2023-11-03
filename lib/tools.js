import { RPI } from "./rpi.js";
import { INat } from "./inat.js";
import { LogMessage } from "./logmessage.js";
import { Calflora } from "./calflora.js";
import { JepsonFamilies } from "./jepsonfamilies.js";
import { JepsonEFlora } from "./jepsoneflora.js";
import { SupplementalText } from "./supplementaltext.js";
import { CommandRunner, Config, Exceptions } from "@ca-plant-list/ca-plant-list";

const TOOLS = {
    CALFLORA: "calflora",
    INAT: "inat",
    JEPSON_EFLORA: "jepson-eflora",
    JEPSON_FAM: "jepson-families",
    RPI: "rpi",
    TEXT: "text",
};

const ALL_TOOLS = [ TOOLS.CALFLORA, TOOLS.INAT, TOOLS.JEPSON_EFLORA, TOOLS.RPI, TOOLS.TEXT ];

const OPTION_DEFS = [
    { name: "datadir", type: String, defaultValue: "./data" },
    { name: "in-taxafile", type: String, defaultValue: "inat_taxa.csv" },
    { name: "ef-lognotes", type: Boolean },
    { name: "loader", type: String },
    { name: "tool", type: String, multiple: true },
];

const OPTION_HELP = [
    {
        name: "datadir",
        type: String,
        typeLabel: "{underline path}",
        description: "The directory in which the data files for the local plant list are located. Defaults to {bold ./data}."
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

class Tools {

    #DataLoader;
    #cr;

    constructor( DataLoader, cr ) {
        this.#DataLoader = DataLoader;
        this.#cr = cr;
    }

    static async run( DataLoader ) {
        const cr = new CommandRunner(
            "ca-plant-tools",
            "Tools to compare plant lists with online plant data.",
            OPTION_DEFS,
            OPTION_HELP,
            ADDITIONAL_HELP,
            ( options ) => tools.runTools( options ),
        );
        const tools = new Tools( DataLoader, cr );
        await cr.processCommandLine();
    }

    async runTools( options ) {

        if ( options.tool === undefined ) {
            // No tools specified; just show help.
            this.#cr.showHelp();
            return;
        }

        const taxa = await this.#DataLoader.load( options.datadir );
        const exceptions = new Exceptions( options.datadir );
        const config = new Config( options.datadir );

        let tools = options.tool;
        if ( tools[ 0 ] === "all" ) {
            tools = ALL_TOOLS;
        }

        for ( const tool of tools ) {
            switch ( tool ) {
                case TOOLS.CALFLORA:
                    await Calflora.analyze( TOOLS_DATA_DIR, taxa, exceptions );
                    break;
                case TOOLS.INAT:
                    await INat.analyze( TOOLS_DATA_DIR, taxa, exceptions, options[ "in-taxafile" ] );
                    break;
                case TOOLS.JEPSON_EFLORA: {
                    const eflora = new JepsonEFlora( TOOLS_DATA_DIR, taxa, options[ "ef-lognotes" ] );
                    await eflora.analyze( exceptions );
                }
                    break;
                case TOOLS.JEPSON_FAM:
                    await JepsonFamilies.build( TOOLS_DATA_DIR );
                    break;
                case TOOLS.RPI:
                    await RPI.analyze( TOOLS_DATA_DIR, taxa, config, exceptions );
                    break;
                case TOOLS.TEXT:
                    SupplementalText.analyze( taxa );
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