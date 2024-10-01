export type HealingConfig = Awaited<ReturnType<typeof getHealingConfig>>;
export const getHealingConfig = async () => {
  return {
    public: {
      entities: {
        "http://data.vlaanderen.be/ns/mandaat#Mandataris": {
          predicates: [
            // this is the minimal config, one could also check all predicates per type, something like this:
            "http://purl.org/dc/terms/modified",
            // "http://data.vlaanderen.be/ns/mandaat#rangorde",
            // "http://data.vlaanderen.be/ns/mandaat#start",
            // "http://data.vlaanderen.be/ns/mandaat#einde",
            // "http://mu.semte.ch/vocabularies/ext/datumEedaflegging",
            // "http://mu.semte.ch/vocabularies/ext/datumMinistrieelBesluit",
            // "http://mu.semte.ch/vocabularies/ext/generatedFrom",
            // "http://www.w3.org/2004/02/skos/core#changeNote",
            // "http://data.vlaanderen.be/ns/mandaat#isTijdelijkVervangenDoor",
            // "http://schema.org/contactPoint",
            // "http://data.vlaanderen.be/ns/mandaat#beleidsdomein",
            // "http://www.w3.org/ns/org#holds",
            // "http://www.w3.org/ns/org#hasMembership",
            // "http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan",
            // "http://data.vlaanderen.be/ns/mandaat#status",
            // "http://mu.semte.ch/vocabularies/ext/lmb/hasPublicationStatus",
          ],
          extraFilter: `OPTIONAL { ?subject <http://lblod.data.gift/vocabularies/lmb/hasPublicationStatus> ?publicationStatus. }
        FILTER(!BOUND(?publicationStatus) || ?publicationStatus != <http://data.lblod.info/id/concept/MandatarisPublicationStatusCode/588ce330-4abb-4448-9776-a17d9305df07>)`,
        },
        "http://data.vlaanderen.be/ns/mandaat#Fractie": [
          "http://purl.org/dc/terms/modified",
        ],
        "http://www.w3.org/ns/org#Membership": [
          "http://purl.org/dc/terms/modified",
        ],
        "http://data.vlaanderen.be/ns/mandaat#Mandaat": [
          "http://purl.org/dc/terms/modified",
        ],
        "http://www.w3.org/ns/person#Person": [
          "http://purl.org/dc/terms/modified",
        ],
        "http://purl.org/dc/terms/PeriodOfTime": [
          "http://purl.org/dc/terms/modified",
        ],
        "http://www.w3.org/ns/activitystreams#Tombstone": [
          "http://purl.org/dc/terms/modified",
        ],
      },
      graphsToExclude: ["http://mu.semte.ch/graphs/besluiten-consumed"],
      graphTypesToExclude: ["http://mu.semte.ch/vocabularies/ext/FormHistory"],
    },
    // abb: {
    //   entities: {
    //     "http://www.w3.org/ns/adms#Identifier": [
    //       "http://purl.org/dc/terms/modified",
    //     ],
    //     "http://data.vlaanderen.be/ns/persoon#Geboorte": [
    //       "http://purl.org/dc/terms/modified",
    //     ],
    //   },
    //   graphsToExclude: ["http://mu.semte.ch/graphs/besluiten-consumed"],
    //   graphTypesToExclude: ["http://mu.semte.ch/vocabularies/ext/FormHistory"],
    // },
  };
};
