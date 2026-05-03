import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { haulPave } from "@/lib/haulpave-client";
import type { CallError, DesignSummary } from "@/lib/types";

export default function Reports() {
  const [project, setProject] = useState("Pit South — Main Haul");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState<DesignSummary | null>(null);
  const [stub, setStub] = useState(false);
  const [stubMessage, setStubMessage] = useState<string>();
  const [running, setRunning] = useState(false);

  const generate = async () => {
    setRunning(true);
    try {
      const res = await haulPave.buildSummary({
        project_name: project,
        author,
      });
      setSummary(res.data);
      setStub(res.stub);
      setStubMessage(res.stubMessage);
    } catch (err) {
      const e = err as CallError;
      toast.error(`build_summary failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const exportJson = async () => {
    if (!summary) return;
    try {
      const path = await save({
        defaultPath: `${project.replace(/\s+/g, "_")}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeTextFile(path, JSON.stringify(summary, null, 2));
      toast.success(`Saved to ${path}`);
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Reports"
        description="Generate a versioned design summary for the current calculation set."
        actions={
          <>
            <Button variant="outline" onClick={generate} disabled={running}>
              <FileText className="h-4 w-4" />
              {running ? "Generating..." : "Generate summary"}
            </Button>
            <Button onClick={exportJson} disabled={!summary}>
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-[360px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="project">Project name</Label>
              <Input
                id="project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="author">Author / engineer</Label>
              <Input
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Name, certification"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Summary preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stub ? <StubBanner message={stubMessage} /> : null}
            {summary ? (
              <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                {JSON.stringify(summary, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click "Generate summary" to build a design report from the most
                recent calculations.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
