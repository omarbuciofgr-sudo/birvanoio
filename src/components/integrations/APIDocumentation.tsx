import { useState } from "react";
import { Book, Code, Copy, Check, ExternalLink, Key, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const APIDocumentation = () => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const baseUrl = "https://api.brivano.io/v1";

  const endpoints = [
    {
      method: "GET",
      path: "/leads",
      description: "List all leads with optional filters",
      params: ["status", "limit", "offset", "sort"],
    },
    {
      method: "GET",
      path: "/leads/:id",
      description: "Get a specific lead by ID",
      params: [],
    },
    {
      method: "POST",
      path: "/leads",
      description: "Create a new lead",
      params: ["business_name", "email", "phone", "status"],
    },
    {
      method: "PATCH",
      path: "/leads/:id",
      description: "Update an existing lead",
      params: ["status", "notes", "lead_score"],
    },
    {
      method: "DELETE",
      path: "/leads/:id",
      description: "Delete a lead",
      params: [],
    },
    {
      method: "POST",
      path: "/leads/:id/call",
      description: "Initiate an AI voice call to a lead",
      params: ["script_template"],
    },
    {
      method: "GET",
      path: "/analytics",
      description: "Get lead analytics and metrics",
      params: ["start_date", "end_date", "group_by"],
    },
  ];

  const codeExamples = {
    curl: `curl -X GET "${baseUrl}/leads" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    javascript: `const response = await fetch('${baseUrl}/leads', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});
const leads = await response.json();`,
    python: `import requests

response = requests.get(
    '${baseUrl}/leads',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    }
)
leads = response.json()`,
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(label);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const generateApiKey = () => {
    // Use cryptographically secure random values instead of Math.random()
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const key = `brv_${Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32)}`;
    setApiKey(key);
    toast.success("API key generated! This is for demonstration only. Production keys should be generated server-side.");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            API Key Management
          </CardTitle>
          <CardDescription>
            Generate and manage your API keys for programmatic access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey || "No API key generated yet"}
                readOnly
                className="font-mono text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowKey(!showKey)}
              >
                <Lock className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={generateApiKey}>
              Generate New Key
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            ⚠️ Keep your API key secure. It provides full access to your account.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="w-5 h-5 text-primary" />
            API Documentation
          </CardTitle>
          <CardDescription>
            RESTful API for integrating Brivano with your applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="endpoints" className="space-y-6">
            <TabsList>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="examples">Code Examples</TabsTrigger>
            </TabsList>

            <TabsContent value="endpoints" className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border mb-4">
                <p className="text-sm font-mono text-foreground">
                  Base URL: <span className="text-primary">{baseUrl}</span>
                </p>
              </div>

              <div className="space-y-3">
                {endpoints.map((endpoint) => (
                  <div
                    key={`${endpoint.method}-${endpoint.path}`}
                    className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${
                            endpoint.method === "GET"
                              ? "border-green-500 text-green-500"
                              : endpoint.method === "POST"
                              ? "border-blue-500 text-blue-500"
                              : endpoint.method === "PATCH"
                              ? "border-yellow-500 text-yellow-500"
                              : "border-red-500 text-red-500"
                          }`}
                        >
                          {endpoint.method}
                        </Badge>
                        <code className="text-sm font-mono text-foreground">
                          {endpoint.path}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            `${baseUrl}${endpoint.path}`,
                            `${endpoint.method}-${endpoint.path}`
                          )
                        }
                      >
                        {copiedEndpoint === `${endpoint.method}-${endpoint.path}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {endpoint.description}
                    </p>
                    {endpoint.params.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {endpoint.params.map((param) => (
                          <Badge key={param} variant="secondary" className="text-xs">
                            {param}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="examples" className="space-y-4">
              <Tabs defaultValue="javascript">
                <TabsList>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                </TabsList>

                {Object.entries(codeExamples).map(([lang, code]) => (
                  <TabsContent key={lang} value={lang}>
                    <div className="relative">
                      <pre className="p-4 rounded-lg bg-muted/50 border border-border overflow-x-auto">
                        <code className="text-sm font-mono text-foreground">
                          {code}
                        </code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(code, lang)}
                      >
                        {copiedEndpoint === lang ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href="#" className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Full API Reference
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="#" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Postman Collection
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default APIDocumentation;
