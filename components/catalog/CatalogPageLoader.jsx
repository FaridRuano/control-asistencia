import styles from "./CatalogPageLoader.module.scss";

export default function CatalogPageLoader({ formVisible = true }) {
  return (
    <div
      className={`${styles.layout} ${!formVisible ? styles.layoutFullWidth : ""}`}
      aria-hidden="true"
    >
      {formVisible ? (
        <div className={styles.formRail}>
          <div className={styles.formColumn}>
            <section className={styles.panel}>
              <div className={styles.heading}>
                <div className={styles.lineXs} />
                <div className={styles.lineMd} />
              </div>

              <div className={styles.formStack}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className={styles.field}>
                    <div className={styles.label} />
                    <div className={styles.input} />
                  </div>
                ))}

                <div className={styles.field}>
                  <div className={styles.label} />
                  <div className={styles.toggle} />
                </div>

                <div className={styles.actions}>
                  <div className={styles.primaryAction} />
                  <div className={styles.secondaryAction} />
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.lineSm} />
          <div className={styles.search} />
          <div className={styles.iconAction} />
        </div>

        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <div className={styles.cellShort} />
            <div className={styles.cellWide} />
            <div className={styles.cellShort} />
            <div className={styles.cellShort} />
          </div>

          <div className={styles.rows}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={styles.row}>
                <div className={styles.cellWide} />
                <div className={styles.cellWide} />
                <div className={styles.cellShort} />
                <div className={styles.actionsDots}>
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
