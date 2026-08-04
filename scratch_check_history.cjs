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

async function check() {
  const { data, error } = await supabase.from("report_card_history").select("*");
  console.log("Error:", error);
  console.log("Data count:", data?.length);
}

check();
