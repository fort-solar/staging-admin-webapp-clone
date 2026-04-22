"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { payoutRecords, transactionMetrics, transactionRecords, type PayoutRecord, type TransactionRecord } from "@/lib/operations-data";
import {
  Button,
  Checkbox,
  MetricCardSecondary,
  Pagination,
  Panel,
  StatusPill,
  Tabs,
  cx,
} from "@/components/dashboard/ui";
import { Modal } from "@/components/dashboard/modals";
import { AttachmentItem, DirectoryToolbar, KeyValueList, TagList } from "@/components/dashboard/management-primitives";
import { CopyIcon, EyeIcon, FilterIcon } from "@/components/dashboard/icons";
import { toneFromStatus } from "@/lib/dashboard-data";

const transactionTabs = ["Transactions", "Payout"] as const;

type TransactionTab = (typeof transactionTabs)[number];

function TransactionMetricsStrip() {
  return (
    <section className="stats-grid--four">
      {transactionMetrics.map((metric) => (
        <MetricCardSecondary key={metric.title} {...metric} />
      ))}
    </section>
  );
}

function transactionMatchesQuery(record: TransactionRecord, query: string) {
  const haystack = `${record.id} ${record.buyer} ${record.product} ${record.method} ${record.amount} ${record.status}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function payoutMatchesQuery(record: PayoutRecord, query: string) {
  const haystack = `${record.id} ${record.installer} ${record.bank} ${record.accountNumber} ${record.amount} ${record.status}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function TransactionsManagementScreen() {
  const [activeTab, setActiveTab] = useState<TransactionTab>("Transactions");
  const [transactions] = useState(transactionRecords);
  const [payouts, setPayouts] = useState(payoutRecords);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const activeTransaction = transactions.find((transaction) => transaction.id === detailId) ?? null;

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => transactionMatchesQuery(transaction, deferredQuery)),
    [deferredQuery, transactions],
  );
  const filteredPayouts = useMemo(() => payouts.filter((payout) => payoutMatchesQuery(payout, deferredQuery)), [deferredQuery, payouts]);

  return (
    <>
      <div className="dashboard-stack">
        <TransactionMetricsStrip />
        <div className="management-surface__tabs is-outside">
          <Tabs value={activeTab} onChange={setActiveTab} options={transactionTabs} />
        </div>
        <Panel className="overflow-hidden">
          <div className="management-surface__body">
            <DirectoryToolbar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search transactions..."
              filters={
                <Button variant="secondary" size="sm" leadingIcon={<FilterIcon className="mini-icon" />}>
                  Filter
                </Button>
              }
            />
          </div>

          {activeTab === "Transactions" ? (
            <div className="table-scroll pt-2">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className="table-checkbox-cell">
                      <Checkbox />
                    </th>
                    <th>Transaction Id</th>
                    <th>Buyer</th>
                    <th>Product</th>
                    <th>Transaction Date</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="table-checkbox-cell">
                        <Checkbox />
                      </td>
                      <td>{transaction.id}</td>
                      <td>{transaction.buyer}</td>
                      <td>
                        <div className="product-cell">
                          <span className="product-thumb" aria-hidden="true" />
                          <span>{transaction.product}</span>
                        </div>
                      </td>
                      <td>{transaction.date}</td>
                      <td>{transaction.amount}</td>
                      <td>{transaction.method}</td>
                      <td>
                        <StatusPill label={transaction.status} tone={transaction.statusTone} />
                      </td>
                      <td className="text-right">
                        <Button variant="secondary" size="sm" leadingIcon={<EyeIcon className="mini-icon" />} onClick={() => setDetailId(transaction.id)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-scroll pt-2">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className="table-checkbox-cell">
                      <Checkbox />
                    </th>
                    <th>Reference Id</th>
                    <th>Installer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Account Details</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="table-checkbox-cell">
                        <Checkbox />
                      </td>
                      <td>{payout.id}</td>
                      <td>{payout.installer}</td>
                      <td>{payout.date}</td>
                      <td>{payout.amount}</td>
                      <td>
                        <StatusPill label={payout.status} tone={payout.statusTone} />
                      </td>
                      <td>
                        <div className="account-detail">
                          <span className="account-detail__bank">BANK</span>
                          <div>
                            <strong>{payout.accountNumber}</strong>
                            <span>{payout.bank}</span>
                          </div>
                          <CopyIcon className="mini-icon" />
                        </div>
                      </td>
                      <td className="text-right">
                        <Button
                          variant={payout.status === "Sent" ? "primary" : "secondary"}
                          size="sm"
                          onClick={() =>
                            setPayouts((current) =>
                              current.map((item) =>
                                item.id === payout.id
                                  ? { ...item, status: "Sent", statusTone: toneFromStatus("Sent") }
                                  : item,
                              ),
                            )
                          }
                        >
                          {payout.status === "Sent" ? "Sent" : "Update"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={24} onChange={setPage} />
        </Panel>
      </div>

      <Modal open={Boolean(activeTransaction)} onClose={() => setDetailId(null)} title={activeTransaction?.id ?? "Transaction"} size="lg">
        {activeTransaction ? (
          <div className="transaction-detail">
            <div className="transaction-detail__status-row">
              <StatusPill label={activeTransaction.status} tone={activeTransaction.statusTone} />
              <span>{activeTransaction.method}</span>
            </div>

            <section className="transaction-detail__section">
              <h3>Buyer Details</h3>
              <div className="transaction-detail__buyer-grid">
                <KeyValueList
                  items={[
                    { label: "Buyer", value: activeTransaction.buyer },
                    { label: "Email", value: activeTransaction.email },
                  ]}
                />
                <KeyValueList
                  items={[
                    { label: "Phone Number", value: activeTransaction.phone },
                    { label: "Address", value: activeTransaction.address },
                  ]}
                />
              </div>
            </section>

            <section className="payment-card">
              <div>
                <h3>Payment Information</h3>
                <p>{activeTransaction.method}</p>
                <span>Transaction ID: {activeTransaction.id}</span>
              </div>
              <strong>Payment Date: {activeTransaction.date}</strong>
            </section>

            <section className="transaction-detail__section">
              <h3>Summary</h3>
              <div className="summary-card">
                <div className="summary-card__top">
                  <strong>{activeTransaction.items.length} Items</strong>
                  <strong>{activeTransaction.amount}</strong>
                </div>
                <div className="summary-card__items">
                  {activeTransaction.items.map((item) => (
                    <div key={item.label} className={cx("summary-item", !item.image && "is-discount")}>
                      {item.image ? (
                        <span className="summary-item__thumb" aria-hidden="true">
                          <span className="product-placeholder" />
                        </span>
                      ) : null}
                      <span>{item.label}</span>
                      <strong>{item.amount}</strong>
                    </div>
                  ))}
                </div>
                <div className="summary-card__total">
                  <strong>Total ({activeTransaction.status})</strong>
                  <strong>₦1,233,500.80</strong>
                </div>
              </div>
            </section>

            <TagList items={["Receipt", "Payment confirmed", "Admin review"]} />
            <AttachmentItem label={`${activeTransaction.id}-receipt.pdf`} helper="Receipt document" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
