import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateSales } from "./sales";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  // Contract: every business has a contact for next-step tasks.
  for (const company of db.companies) {
    if (!db.contacts.some(contact => contact.company_id === company.id)) {
      db.contacts.push({ id: db.contacts.length, first_name: "Front desk", last_name: "", title: "", company_id: company.id,
        email_jsonb: [], phone_jsonb: [{ number: company.phone_number, type: "Work" }], tags: [], gender: "", status: "cold",
        background: "", first_seen: company.created_at, last_seen: company.created_at, has_newsletter: false, sales_id: company.sales_id });
      company.nb_contacts = 1;
    }
  }
  db.call_logs = [];
  db.whatsapp_opens = [];
  db.enquiry_tests = [];
  db.contact_notes = generateContactNotes(db);
  db.deals = generateDeals(db);
  db.deal_notes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
