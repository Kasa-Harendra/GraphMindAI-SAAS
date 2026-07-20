import type { SourceType } from "@/store/graphStore";
import {
  TbFileText,
  TbWorld,
  TbBrandYoutube,
  TbBrandGithub,
  TbMicrophone,
  TbMarkdown,
  TbJson,
  TbPhoto,
  TbMessage,
  TbFile,
} from "react-icons/tb";

export const SOURCE_META: Record<SourceType, { icon: React.ElementType; label: string; color: string }> = {
  pdf:       { icon: TbFileText,      label: "PDF",         color: "text-rose-400" },
  docx:      { icon: TbFileText,      label: "DOCX",        color: "text-blue-400" },
  txt:       { icon: TbFile,          label: "TXT",         color: "text-slate-400" },
  web:       { icon: TbWorld,         label: "Website",     color: "text-cyan-400" },
  youtube:   { icon: TbBrandYoutube,  label: "YouTube",     color: "text-red-500" },
  github:    { icon: TbBrandGithub,   label: "GitHub",      color: "text-violet-400" },
  markdown:  { icon: TbMarkdown,      label: "Markdown",    color: "text-emerald-400" },
  json:      { icon: TbJson,          label: "JSON/CSV",    color: "text-amber-400" },
  image:     { icon: TbPhoto,         label: "Image",       color: "text-pink-400" },
  whatsapp:  { icon: TbMessage,       label: "WhatsApp",    color: "text-green-400" },
  audio:     { icon: TbMicrophone,    label: "Audio",       color: "text-orange-400" },
};
