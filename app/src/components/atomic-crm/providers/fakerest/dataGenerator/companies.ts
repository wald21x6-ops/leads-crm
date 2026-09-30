import {
  address,
  company,
  datatype,
  internet,
  lorem,
  random,
} from "faker/locale/en_US";

import { randomDate } from "./utils";
import { defaultCompanySectors } from "../../../root/defaultConfiguration";
import type { Company, RAFile } from "../../../types";
import type { Db } from "./types";

const sizes = [1, 10, 50, 250, 500];

const regex = /\W+/;

export const generateCompanies = (db: Db, size = 55): Required<Company>[] => {
  return Array.from(Array(size).keys()).map((id) => {
    const name = company.companyName();
    return {
      id,
      name: name,
      external_key: `demo-${id}.example`,
      research_status: id % 3 === 0 ? "to_research" : "done",
      research: id % 3 === 0 ? null : {
        version: 1,
        facts: [{ text: "Demo website has an enquiry form", source: "https://example.com" }],
        score_why: "+1 enquiry form; demo data only",
        owner: { name: "Demo owner", source_url: "https://example.com", confidence: "medium" },
        complaints: [{ quote: "Demo complaint — awaiting verification", url: "https://example.com", verified_by_human: false }],
        instant_reply: { chat_tools: [], booking_tools: ["Cal.com"], has_form: true },
        marketplaces: [{ name: "Demo directory", url: "https://example.com" }],
      },
      first_line: "Does your website enquiry form get answered after hours?",
      score: id % 6,
      timezone: "America/Chicago",
      source: "demo",
      business_type: "Demo business",
      logo: {
        title: lorem.text(1),
        src: `https://marmelab.com/react-admin-crm/logos/${id}.png`,
      } as RAFile,
      sector: random.arrayElement(defaultCompanySectors).value,
      size: random.arrayElement(sizes) as 1 | 10 | 50 | 250 | 500,
      linkedin_url: `https://www.linkedin.com/company/${name
        .toLowerCase()
        .replace(regex, "_")}`,
      website: internet.url(),
      phone_number: `+1202555${String(100 + id).padStart(4, "0")}`,
      address: address.streetAddress(),
      zipcode: address.zipCode(),
      city: address.city(),
      state_abbr: address.stateAbbr(),
      nb_contacts: 0,
      nb_deals: 0,
      // at least 1/3rd of companies for Jane Doe
      sales_id: datatype.number(2) === 0 ? 0 : random.arrayElement(db.sales).id,
      created_at: randomDate().toISOString(),
      description: lorem.paragraph(),
      revenue: random.arrayElement(["$1M", "$10M", "$100M", "$1B"]),
      tax_identifier: random.alphaNumeric(10),
      country: random.arrayElement(["USA", "France", "UK"]),
      context_links: [],
    };
  });
};
