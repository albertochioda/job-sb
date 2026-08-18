import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("search_configs")
    .select("roles, city, country, radius_km, min_salary, work_mode, work_schedule, contract_types")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  return NextResponse.json(data ?? {});
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { roles, city, country, geo_id, radius_km, min_salary, work_mode, work_schedule, contract_types } = body;

  // Difesa in profondità: la UI garantisce sempre un geo_id quando la
  // città non è vuota (autocomplete obbligatorio). L'unica eccezione
  // legittima per città-senza-geo_id è un valore già salvato in
  // precedenza e non toccato in questa modifica (utente che cambia altri
  // campi) — qualunque altro caso è un bypass della UI, non un utente
  // reale che ha semplicemente lasciato un campo invariato.
  if (city && !geo_id) {
    const { data: existing } = await supabase
      .from("search_configs")
      .select("city")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();
    if (!existing || existing.city !== city) {
      return NextResponse.json({
        error: "invalid_city",
        message: "Seleziona una città dal menu di suggerimenti prima di salvare.",
      }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("search_configs")
    .update({
      roles, city, country: country || "Italia", geo_id: geo_id || null, radius_km, min_salary,
      work_mode: work_mode || "nessuna_preferenza",
      work_schedule: work_schedule || "nessuna_preferenza",
      contract_types: contract_types?.length ? contract_types : null,
    })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) {
    console.error("[search-config] errore DB:", error.message);
    return NextResponse.json({ error: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { cv_id, roles, city, geo_id, country, radius_km, min_salary, work_mode, work_schedule, contract_types } = body;

  if (!cv_id || !roles?.length) {
    return NextResponse.json({ error: "missing_fields", message: "cv_id e roles sono obbligatori" }, { status: 400 });
  }
  // Difesa in profondità: nessuna configurazione precedente da
  // "grandfather" qui (è un inserimento nuovo), quindi nessuna eccezione —
  // la UI garantisce sempre un geo_id quando la città non è vuota.
  if (city && !geo_id) {
    return NextResponse.json({
      error: "invalid_city",
      message: "Seleziona una città dal menu di suggerimenti prima di salvare.",
    }, { status: 400 });
  }

  // Deactivate previous configs
  await supabase.from("search_configs").update({ is_active: false }).eq("user_id", user.id);

  const { data, error } = await supabase
    .from("search_configs")
    .insert({
      user_id: user.id,
      cv_id,
      roles,
      city: city || null,
      geo_id: geo_id || null,
      country: country || "Italia",
      radius_km: radius_km || 50,
      min_salary: min_salary || null,
      work_mode: work_mode || "nessuna_preferenza",
      work_schedule: work_schedule || "nessuna_preferenza",
      contract_types: contract_types?.length ? contract_types : null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[search-config] errore DB:", error.message);
    return NextResponse.json({ error: "db_error", message: "Si è verificato un errore, riprova più tardi" }, { status: 500 });
  }

  return NextResponse.json({ config_id: data.id });
}
