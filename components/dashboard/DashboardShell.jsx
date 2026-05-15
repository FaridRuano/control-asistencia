"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import LogoutButton from "@/components/auth/LogoutButton";
import TransitionLink from "@/components/navigation/TransitionLink";
import { PLANNING_MODULE } from "@/lib/modules/planning/module";
import styles from "./DashboardShell.module.scss";

export default function DashboardShell({ title, description, children, moduleConfig = PLANNING_MODULE }) {
  const pathname = usePathname();
  const navigation = moduleConfig.navigation || [];
  const [openSection, setOpenSection] = useState(() => {
    const sectionWithActiveChild = navigation.find((section) =>
      section.items.some((item) => item.href === pathname),
    );

    return sectionWithActiveChild?.title || "";
  });

  function isSectionActive(section) {
    if (pathname === section.href) {
      return true;
    }

      return section.items.some((item) => item.href === pathname);
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarMain}>
          <div className={styles.brand}>
            <div className={styles.logoWrap}>
              <Image
                src="/imgs/logo-chimg.png"
                alt="Logo de la empresa"
                width={42}
                height={42}
                className={styles.logo}
                priority
              />
            </div>

            <div>
              <p className={styles.brandEyebrow}>Módulo activo</p>
              <p className={styles.brandTitle}>{moduleConfig.title}</p>
            </div>
          </div>

          <TransitionLink href={moduleConfig.modulesHref || "/modules"} className={styles.moduleSwitcher}>
            Cambiar módulo
          </TransitionLink>

          <nav className={styles.nav}>
            {navigation.map((section) => {
              const isOpen = openSection === section.title;
              const isActive = isSectionActive(section);
              const hasChildren = section.items.length > 0 && section.href !== moduleConfig.homeHref;

              return (
                <div
                  key={section.title}
                  className={`${styles.navSection} ${isOpen ? styles.navSectionOpen : ""} ${isActive ? styles.navSectionActive : ""}`}
                >
                  <div className={styles.navSectionSummary}>
                    <TransitionLink
                      href={section.href}
                      className={`${styles.navSectionLink} ${isActive ? styles.navSectionLinkActive : ""}`}
                    >
                      <span className={styles.navSectionTitle}>{section.title}</span>
                    </TransitionLink>
                    {hasChildren ? (
                      <button
                        type="button"
                        className={styles.navToggle}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Ocultar ${section.title}` : `Mostrar ${section.title}`}
                        onClick={() =>
                          setOpenSection((current) => (current === section.title ? "" : section.title))
                        }
                      >
                        <ChevronDown size={16} className={styles.navChevron} />
                      </button>
                    ) : null}
                  </div>

                  <div className={`${styles.navSectionBody} ${!hasChildren ? styles.navSectionBodyHidden : ""}`}>
                    <div className={styles.navSectionItems}>
                      {section.items.map((item) => {
                        const active = pathname === item.href;

                        return (
                          <div key={item.href} className={styles.navItemWrap}>
                            <TransitionLink
                              href={item.href}
                              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                            >
                              <span className={styles.navLabel}>{item.label}</span>
                            </TransitionLink>
                            <span role="tooltip" className={styles.navTooltip}>
                              {item.description}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <LogoutButton />
        </div>
      </aside>

      <main className={styles.content}>
        <header className={`${styles.header} page-entrance`}>
          <div>
            <p className={styles.eyebrow}>Dashboard</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>
        </header>

        <section className="page-entrance page-entrance-delay-sm">{children}</section>
      </main>
    </div>
  );
}
