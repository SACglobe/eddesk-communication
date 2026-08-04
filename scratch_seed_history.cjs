const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

let env = {};
try {
  const envContent = fs.readFileSync(".env.local", "utf8");
  envContent.split("\n").forEach(line => {
    const [k, v] = line.split("=");
    if (k && v) env[k.trim()] = v.trim();
  });
} catch(e) {}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "chithraiselvan.a@gmail.com",
    password: "EdDesk@123",
  });

  if (authError || !authData.user) {
    console.error("Auth error:", authError);
    return;
  }

  const schoolkey = "8539b5db-946c-4f5a-96bd-f777e1a21ff8";
  const userId = authData.user.id;
  
  const sampleStudents = [
    { name: "Aarav Sundaram", class: "8 Th Std", sec: "SECTION A", exam: "Quarterly Examination", mobile: "9994026550", status: "delivered" },
    { name: "Selvan Annamalai", class: "8 Th Std", sec: "SECTION A", exam: "Quarterly Examination", mobile: "9994026550", status: "read" },
    { name: "Priya Ramesh", class: "9 Th Std", sec: "SECTION B", exam: "Mid Term Exam", mobile: "9876543210", status: "delivered" },
    { name: "Karthik Raja", class: "9 Th Std", sec: "SECTION B", exam: "Mid Term Exam", mobile: "9876543211", status: "failed" },
    { name: "Divya Bharathi", class: "10 Th Std", sec: "SECTION A", exam: "Unit Test 1", mobile: "9876543212", status: "read" },
    { name: "Vijay Kumar", class: "10 Th Std", sec: "SECTION A", exam: "Unit Test 1", mobile: "9876543213", status: "delivered" },
    { name: "Ananya S", class: "8 Th Std", sec: "SECTION B", exam: "Quarterly Examination", mobile: "9876543214", status: "sent" },
    { name: "Rohan V", class: "8 Th Std", sec: "SECTION B", exam: "Quarterly Examination", mobile: "9876543215", status: "read" },
    { name: "Siddharth M", class: "9 Th Std", sec: "SECTION A", exam: "Mid Term Exam", mobile: "9876543216", status: "delivered" },
    { name: "Meera Krishnan", class: "9 Th Std", sec: "SECTION A", exam: "Mid Term Exam", mobile: "9876543217", status: "failed" },
    { name: "Ganesh P", class: "10 Th Std", sec: "SECTION B", exam: "Unit Test 2", mobile: "9876543218", status: "read" },
    { name: "Lakshmi N", class: "10 Th Std", sec: "SECTION B", exam: "Unit Test 2", mobile: "9876543219", status: "delivered" },
    { name: "Harish R", class: "8 Th Std", sec: "SECTION A", exam: "Half Yearly Exam", mobile: "9876543220", status: "sent" },
    { name: "Kavya T", class: "8 Th Std", sec: "SECTION A", exam: "Half Yearly Exam", mobile: "9876543221", status: "delivered" },
    { name: "Surya K", class: "9 Th Std", sec: "SECTION B", exam: "Half Yearly Exam", mobile: "9876543222", status: "read" },
  ];

  for (let i = 0; i < sampleStudents.length; i++) {
    const s = sampleStudents[i];
    const { error } = await supabase.from("report_card_history").insert({
      user_id: userId,
      schoolkey: schoolkey,
      studentname: s.name,
      mobile: s.mobile,
      classsec: `${s.class} - ${s.sec}`,
      examname: s.exam,
      message: `🎓 Sunrise International 🎓\nDear Parent, report card for ${s.exam} is ready. Student: ${s.name}`,
      status: s.status,
      sender_email: "chithraiselvan.a@gmail.com",
      created_at: new Date(Date.now() - (i * 3600000)).toISOString()
    });
    if (error) console.error("Insert error:", error);
  }

  console.log("Successfully seeded 15 history entries with user_id!");
}

seed();
