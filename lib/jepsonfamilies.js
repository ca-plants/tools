import path from "node:path";
import { Files } from "@ca-plant-list/ca-plant-list";
import { HTMLTree } from "./htmltree.js";

class JepsonFamilies {
    /**
     * @param {string} toolsDataDir
     * @param {string} outputdir
     */
    static async build(toolsDataDir, outputdir) {
        const url = "https://ucjeps.berkeley.edu/eflora/toc.html";
        const indexFileName = path.basename(url);
        const toolsDataPath = toolsDataDir + "/jepsonfam";
        const indexFilePath = toolsDataPath + "/" + indexFileName;

        // Create data directory if it's not there.
        Files.mkdir(toolsDataPath);

        // Download the data file if it doesn't exist.
        if (!Files.exists(indexFilePath)) {
            console.log("retrieving Jepson family index");
            await Files.fetch(url, indexFilePath);
        }

        const document = HTMLTree.getTreeFromFile(indexFilePath);
        const body = HTMLTree.getSubTree(document, (t) => t.tagName === "body");
        const contentDiv = HTMLTree.getSubTree(
            body,
            (t) => HTMLTree.getAttr(t, "id") === "content"
        );
        const rows = HTMLTree.getSubTrees(
            contentDiv,
            (t) => t.tagName === "tr"
        );

        this.#parseRows(outputdir, rows);
    }

    static #parseRows(toolsDataPath, rows) {
        const families = {};
        const genera = {};

        for (const row of rows) {
            const cols = HTMLTree.getSubTrees(row, (t) => t.tagName === "td");
            if (!cols || cols.length < 3) {
                continue;
            }

            // Find the section.
            const section = cols[0].childNodes[0].value;

            // Find the family name and ID.
            const familyLink = cols[1].childNodes[0];
            const familyTarget = HTMLTree.getAttr(familyLink, "href");
            const familyID = familyTarget.split("=")[1];
            const familyName = familyLink.childNodes[0].value;
            families[familyName] = { section: section, id: familyID };

            // Find all the genera.
            const genusLinks = HTMLTree.getSubTrees(
                cols[2],
                (t) => t.tagName === "a"
            );
            for (const genusLink of genusLinks) {
                const genusTarget = HTMLTree.getAttr(genusLink, "href");
                const genusID = genusTarget.split("=")[1];
                const genusName = genusLink.childNodes[0].value;
                genera[genusName] = { family: familyName, id: genusID };
            }
        }

        Files.write(
            toolsDataPath + "/families.json",
            JSON.stringify(families),
            true
        );
        Files.write(
            toolsDataPath + "/genera.json",
            JSON.stringify(genera),
            true
        );
    }
}

export { JepsonFamilies };
