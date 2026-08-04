"use client";

import { Mail, Phone, MapPin, FileText, ArrowRight, ExternalLink, Headset } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { PageHeader } from "@/components/ui-kit";

export default function ContactPage() {
  const { isLoading, isAuthorized, accessError } = useAuthGuard(true);

  if (accessError) {
    return <AccessDenied type={accessError} />;
  }

  if (isLoading || !isAuthorized) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl">
        <PageHeader
          eyebrow="SUPPORT"
          title="Contact & Support"
          description="Have questions or need assistance? Reach out to our support team or review our legal policies."
        />

        {/* Contact & Support Main Card */}
        <section className="surface rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm border border-border/80">
          <div className="flex items-center gap-4 border-b border-border/60 pb-5">
            <div className="grid size-12 place-items-center rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 shrink-0">
              <Phone className="size-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Contact & Support</h2>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mt-0.5">
                GET IN TOUCH WITH US
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
            {/* Email Us */}
            <div className="rounded-2xl border border-border/70 bg-background/60 p-5 space-y-3 transition-colors hover:border-border">
              <div className="grid size-10 place-items-center rounded-xl bg-rose-50/90 text-rose-500">
                <Mail className="size-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">EMAIL US</p>
                <a
                  href="mailto:support@eddesk.in"
                  className="font-display text-base font-bold text-foreground hover:text-primary transition-colors block mt-0.5"
                >
                  support@eddesk.in
                </a>
                <p className="text-xs text-muted-foreground mt-1">We respond within 24 hours</p>
              </div>
            </div>

            {/* Call Us */}
            <div className="rounded-2xl border border-border/70 bg-background/60 p-5 space-y-3 transition-colors hover:border-border">
              <div className="grid size-10 place-items-center rounded-xl bg-rose-50/90 text-rose-500">
                <Phone className="size-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">CALL US</p>
                <a
                  href="tel:+91812233929"
                  className="font-display text-base font-bold text-foreground hover:text-primary transition-colors block mt-0.5"
                >
                  +91 81223 3929
                </a>
                <p className="text-xs text-muted-foreground mt-1">Mon-Sat, 9 AM to 6 PM IST</p>
              </div>
            </div>

            {/* Visit Us */}
            <div className="rounded-2xl border border-border/70 bg-background/60 p-5 space-y-3 transition-colors hover:border-border">
              <div className="grid size-10 place-items-center rounded-xl bg-rose-50/90 text-rose-500">
                <MapPin className="size-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500">VISIT US</p>
                <p className="font-display text-sm font-bold text-foreground leading-snug mt-0.5">
                  49/3, Nadar Street Keela Eral, Tuticorin Tamil Nadu – 628908
                </p>
                <p className="text-xs text-muted-foreground mt-1">Registered Office</p>
              </div>
            </div>
          </div>
        </section>

        {/* Legal Policies & Agreements Card */}
        <section className="surface rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm border border-border/80">
          <div className="border-b border-border/60 pb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              LEGAL POLICIES & AGREEMENTS
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Read our compliance policies and platform service agreements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Privacy Policy */}
            <a
              href="https://www.eddesk.in/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 p-5 transition-all hover:border-primary/40 hover:bg-primary-soft/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="grid size-11 place-items-center rounded-xl bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <FileText className="size-5.5" strokeWidth={1.9} />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    Privacy Policy
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How we handle and protect school data
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1 shrink-0 ml-3" strokeWidth={2} />
            </a>

            {/* Terms & Conditions */}
            <a
              href="https://www.eddesk.in/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 p-5 transition-all hover:border-primary/40 hover:bg-primary-soft/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="grid size-11 place-items-center rounded-xl bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <FileText className="size-5.5" strokeWidth={1.9} />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    Terms & Conditions
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Platform rules and service agreement
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1 shrink-0 ml-3" strokeWidth={2} />
            </a>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
