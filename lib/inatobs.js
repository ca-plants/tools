import { Files } from "@ca-plant-list/ca-plant-list";

class INatObs {

    static async retrieve( toolsDataDir ) {

        const url = new URL( "https://api.inaturalist.org/v1/observations?project_id=ebcnps&taxon_id=58859%2C53355" );
        const response = await fetch( url );
        const data = await response.json();

        const outputRows = [];
        outputRows.push(
            [
                "taxon",
                "obs_date",
                "latitude",
                "longitude",
                "pos_accuracy",
                "pub_pos_accuracy",
                "obscured",
                "geoprivacy",
                "taxonGeoPrivacy",
                "login",
                "username",
                "id",
                "description"
            ].join( "\t" )
        );

        for ( const result of data.results ) {
            const taxonGeoPrivacy = result.taxon_geoprivacy;
            const obsDate = result.observed_on_details.date;
            const obsID = result.id;
            const positionalAccuracy = result.positional_accuracy;
            const publicPositionalAccuracy = result.public_positional_accuracy;
            const description = result.description;
            const taxonName = result.taxon.name;
            const longLat = result.geojson.coordinates;
            const geoprivacy = result.geoprivacy;
            const obscured = result.obscured;
            const login = result.user.login;
            const userName = result.user.name;
            outputRows.push(
                [
                    taxonName,
                    obsDate,
                    longLat[1],
                    longLat[0],
                    positionalAccuracy,
                    publicPositionalAccuracy,
                    obscured,
                    geoprivacy,
                    taxonGeoPrivacy,
                    login,
                    userName,
                    obsID,
                    description
                ].join( "\t" )
            );
        }

        Files.write( toolsDataDir + "/inato.tsv", outputRows.join( "\n" ), true );
    }

}

export { INatObs };