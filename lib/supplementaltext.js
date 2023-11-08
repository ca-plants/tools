import { Files } from "@ca-plant-list/ca-plant-list";

class SupplementalText {

    static analyze( taxa, errorLog ) {

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
            const taxon = taxa.getTaxon( taxonName );
            if ( taxon ) {
                continue;
            }
            errorLog.log( dirName + "/" + entry, "not found in taxa.csv" );
        }

    }

}

export { SupplementalText };