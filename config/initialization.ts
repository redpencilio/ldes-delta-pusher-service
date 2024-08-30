const regularTypes = {
  "http://data.vlaanderen.be/ns/mandaat#Fractie": "public",
  "http://www.w3.org/ns/org#Membership": "public",
  "http://data.vlaanderen.be/ns/mandaat#Mandaat": "public",
  "http://purl.org/dc/terms/PeriodOfTime": "public",
  "http://www.w3.org/ns/adms#Identifier": "abb",
  "http://data.vlaanderen.be/ns/persoon#Geboorte": "abb",
  "http://schema.org/ContactPoint": "abb",
  "http://www.w3.org/ns/locn#Address": "abb",
};

export const initialization = {
  public: {
    "http://data.vlaanderen.be/ns/mandaat#Mandataris": {
      filter: `
        OPTIONAL { ?s <http://mu.semte.ch/vocabularies/ext/lmb/hasPublicationStatus> ?publicationStatus. }
        FILTER(!BOUND(?publicationStatus) || ?publicationStatus != <http://data.lblod.info/id/concept/MandatarisPublicationStatusCode/588ce330-4abb-4448-9776-a17d9305df07>)`,
    },
    "http://www.w3.org/ns/person#Person": {
      filter: `FILTER(?p NOT IN (<http://data.vlaanderen.be/ns/persoon#heeftGeboorte>, <http://www.w3.org/ns/adms#identifier>, <http://data.vlaanderen.be/ns/persoon#geslacht>))
      `,
    },
  },
  abb: {
    // meaning there is no filter
    "http://data.vlaanderen.be/ns/mandaat#Mandataris": {},
    "http://www.w3.org/ns/person#Person": {},
  },
  internal: {
    "http://data.vlaanderen.be/ns/mandaat#Mandataris": {},
    "http://www.w3.org/ns/person#Person": {},
  },
};

Object.keys(regularTypes).forEach((type) => {
  const level = regularTypes[type];
  if (level === "public") {
    initialization.public[type] = {};
    initialization.abb[type] = {};
    initialization.internal[type] = {};
  } else if (level === "abb") {
    initialization.abb[type] = {};
    initialization.internal[type] = {};
  } else if (level === "internal") {
    initialization.internal[type] = {};
  }
});
