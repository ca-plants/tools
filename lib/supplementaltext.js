import { Files } from "@ca-plant-list/ca-plant-list";
import { LogMessage } from "./logmessage.js";

class SupplementalText {

    static analyze( Taxa ) {

        function fileNameToTaxonName( fileName ) {
            const parts = fileName.split( "." );
            return parts[ 0 ].replace( "-", " " ).replace( "-var-", " var. " ).replace( "-subsp-", " subsp. " );
        }

        const dirName = "data/text";

        if ( !Files.isDir( dirName ) ) {
            return;
        }

        const entries = Files.getDirEntries( dirName );
        for ( const entry of entries ) {
            const taxonName = fileNameToTaxonName( entry );
            const taxon = Taxa.getTaxon( taxonName );
            if ( taxon ) {
                continue;
            }
            LogMessage.log( dirName + "/" + entry, "not found in taxa.csv" );
        }

    }

}

export { SupplementalText };