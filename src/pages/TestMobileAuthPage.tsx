import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function decode_jwt(token: string): any {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function TestMobileAuthPage() {
  const [token, set_token] = useState("");
  const [loading, set_loading] = useState(false);
  const [response, set_response] = useState<any>(null);
  const [error, set_error] = useState<string | null>(null);

  const fn_url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-auth-login`;

  const handle_test = async () => {
    set_loading(true);
    set_error(null);
    set_response(null);
    try {
      const res = await fetch(fn_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        set_error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
      } else {
        set_response(data);
      }
    } catch (e: any) {
      set_error(String(e));
    } finally {
      set_loading(false);
    }
  };

  const claims = response?.access_token ? decode_jwt(response.access_token) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Test Mobile Auth Login</h1>
      <p className="text-sm text-muted-foreground">
        Scambia un token QR (tabella <code>inviti_genitori.token</code>) con una sessione Supabase autenticata.
        Endpoint: <code>{fn_url}</code>
      </p>

      <Card className="p-4 space-y-3">
        <div>
          <Label htmlFor="token">QR Token</Label>
          <Input
            id="token"
            value={token}
            onChange={(e) => set_token(e.target.value)}
            placeholder="es. ASGXBQJFNAMY"
            className="font-mono"
          />
        </div>
        <Button onClick={handle_test} disabled={!token.trim() || loading}>
          {loading ? "Test in corso…" : "Test login"}
        </Button>
      </Card>

      {error && (
        <Card className="p-4 border-destructive">
          <h3 className="font-semibold text-destructive mb-2">Errore</h3>
          <pre className="text-xs whitespace-pre-wrap">{error}</pre>
        </Card>
      )}

      {response && (
        <>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Atleta / Club</h3>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify({ atleta: response.atleta, club: response.club }, null, 2)}</pre>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Tokens</h3>
            <div className="text-xs space-y-2 break-all">
              <div><strong>access_token:</strong> {response.access_token}</div>
              <div><strong>refresh_token:</strong> {response.refresh_token}</div>
              <div><strong>expires_in:</strong> {response.expires_in}s</div>
            </div>
          </Card>

          {claims && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">JWT Claims (decoded)</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(claims, null, 2)}</pre>
              <div className="mt-3 text-sm space-y-1">
                <div><strong>sub (user_id):</strong> {claims.sub}</div>
                <div><strong>role:</strong> {claims.role}</div>
                <div><strong>user_metadata.atleta_id:</strong> {claims.user_metadata?.atleta_id}</div>
                <div><strong>user_metadata.club_id:</strong> {claims.user_metadata?.club_id}</div>
                <div><strong>user_metadata.role:</strong> {claims.user_metadata?.role}</div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
