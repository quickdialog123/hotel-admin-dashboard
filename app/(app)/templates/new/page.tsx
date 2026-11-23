import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { TemplateWizard } from "@/components/broadcasts/template-wizard"

export default function NewTemplatePage() {
  return (
    <>
      <Link href="/templates" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Templates
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New template</h1>
      <TemplateWizard />
    </>
  )
}
