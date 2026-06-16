// src/lib/exportExcel.ts
// Utility functions to export CRM data to Excel (.xlsx)
// Uses SheetJS (xlsx) library — run: npm install xlsx

import * as XLSX from 'xlsx';
import { Parent, Tutor, FeeRecord, AttendanceRecord, CommunicationLog, Assignment, Task } from './firestore';

// ── Helper — download a workbook as .xlsx ─────────────────────────────────────

function download(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, `${filename}_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.xlsx`);
}

function makeSheet<T extends object>(data: T[], columns: { key: keyof T; header: string }[]) {
  const rows = data.map(item =>
    Object.fromEntries(columns.map(col => [col.header, item[col.key] ?? '']))
  );
  return XLSX.utils.json_to_sheet(rows, { header: columns.map(c => c.header) });
}

// Auto-width columns
function autoWidth(sheet: XLSX.WorkSheet, columns: { header: string }[]) {
  const widths = columns.map(col => ({ wch: Math.max(col.header.length + 4, 14) }));
  sheet['!cols'] = widths;
}

// ── Export Parents ────────────────────────────────────────────────────────────

export function exportParents(parents: Parent[]) {
  const cols: { key: keyof Parent; header: string }[] = [
    { key: 'name',            header: 'Parent Name'       },
    { key: 'phone',           header: 'Phone'             },
    { key: 'email',           header: 'Email'             },
    { key: 'area',            header: 'Area'              },
    { key: 'class',           header: 'Class'             },
    { key: 'subject',         header: 'Subject'           },
    { key: 'preferredGender', header: 'Preferred Gender'  },
    { key: 'budget',          header: 'Budget (₹/month)'  },
    { key: 'source',          header: 'Lead Source'       },
    { key: 'status',          header: 'Status'            },
    { key: 'notes',           header: 'Notes'             },
  ];

  const sheet = makeSheet(parents, cols);
  autoWidth(sheet, cols);

  // Style header row
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Parents');
  download(wb, 'Jilani_CRM_Parents');
}

// ── Export Tutors ─────────────────────────────────────────────────────────────

export function exportTutors(tutors: Tutor[]) {
  const cols: { key: keyof Tutor; header: string }[] = [
    { key: 'name',          header: 'Tutor Name'       },
    { key: 'phone',         header: 'Phone'            },
    { key: 'email',         header: 'Email'            },
    { key: 'gender',        header: 'Gender'           },
    { key: 'area',          header: 'Area'             },
    { key: 'qualification', header: 'Qualification'    },
    { key: 'subjects',      header: 'Subjects'         },
    { key: 'classes',       header: 'Classes'          },
    { key: 'experience',    header: 'Experience'       },
    { key: 'availability',  header: 'Availability'     },
    { key: 'monthlyFee',    header: 'Expected Fee (₹)' },
    { key: 'status',        header: 'Status'           },
    { key: 'notes',         header: 'Notes'            },
  ];

  const sheet = makeSheet(tutors, cols);
  autoWidth(sheet, cols);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Tutors');
  download(wb, 'Jilani_CRM_Tutors');
}

// ── Export Fees ───────────────────────────────────────────────────────────────

export function exportFees(fees: FeeRecord[]) {
  const cols: { key: keyof FeeRecord; header: string }[] = [
    { key: 'tutorName',     header: 'Tutor Name'       },
    { key: 'parentName',    header: 'Parent Name'      },
    { key: 'subject',       header: 'Subject'          },
    { key: 'classLevel',    header: 'Class'            },
    { key: 'month',         header: 'Month'            },
    { key: 'parentFee',     header: 'Parent Pays (₹)'  },
    { key: 'tutorFee',      header: 'Tutor Gets (₹)'   },
    { key: 'profit',        header: 'Profit (₹)'       },
    { key: 'paymentStatus', header: 'Payment Status'   },
    { key: 'notes',         header: 'Notes'            },
  ];

  const sheet = makeSheet(fees, cols);
  autoWidth(sheet, cols);

  // Add summary at bottom
  const lastRow = fees.length + 2;
  const confirmed = fees.filter(f => f.paymentStatus !== 'pending');
  const totalRevenue = confirmed.reduce((s,f) => s + (f.parentFee||0), 0);
  const totalTutor   = confirmed.reduce((s,f) => s + (f.tutorFee||0), 0);
  const totalProfit  = totalRevenue - totalTutor;

  XLSX.utils.sheet_add_aoa(sheet, [
    [''],
    ['SUMMARY'],
    ['Total Revenue (confirmed)',    '', '', '', '', totalRevenue,  '', '', ''],
    ['Total Tutor Payments (confirmed)', '', '', '', '', '', totalTutor, '', ''],
    ['Net Profit',                  '', '', '', '', '', '', totalProfit, ''],
    ['Total Records',               fees.length],
  ], { origin: `A${lastRow}` });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Fees');
  download(wb, 'Jilani_CRM_Fees');
}

// ── Export Attendance ─────────────────────────────────────────────────────────

export function exportAttendance(records: AttendanceRecord[]) {
  const cols: { key: keyof AttendanceRecord; header: string }[] = [
    { key: 'date',            header: 'Date'             },
    { key: 'studentName',     header: 'Student Name'     },
    { key: 'tutorName',       header: 'Tutor Name'       },
    { key: 'subject',         header: 'Subject'          },
    { key: 'classLevel',      header: 'Class'            },
    { key: 'status',          header: 'Status'           },
    { key: 'sessionDuration', header: 'Duration (mins)'  },
    { key: 'notes',           header: 'Notes'            },
  ];

  const sheet = makeSheet(records, cols);
  autoWidth(sheet, cols);

  // Summary
  const total     = records.filter(r => r.status !== 'holiday').length;
  const present   = records.filter(r => r.status === 'present').length;
  const absent    = records.filter(r => r.status === 'absent').length;
  const rate      = total ? Math.round((present/total)*100) : 0;
  const totalHrs  = Math.round(records.filter(r=>r.status==='present').reduce((s,r)=>s+(r.sessionDuration||0),0)/60);

  const lastRow = records.length + 2;
  XLSX.utils.sheet_add_aoa(sheet, [
    [''],
    ['SUMMARY'],
    ['Total Sessions (excl. holidays)', total],
    ['Present',                         present],
    ['Absent',                          absent],
    ['Attendance Rate',                 `${rate}%`],
    ['Total Hours Taught',              `${totalHrs}h`],
  ], { origin: `A${lastRow}` });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Attendance');
  download(wb, 'Jilani_CRM_Attendance');
}

// ── Export Assignments ────────────────────────────────────────────────────────

export function exportAssignments(assignments: Assignment[]) {
  const cols: { key: keyof Assignment; header: string }[] = [
    { key: 'tutorName',        header: 'Tutor Name'          },
    { key: 'tutorPhone',       header: 'Tutor Phone'         },
    { key: 'parentName',       header: 'Parent Name'         },
    { key: 'parentPhone',      header: 'Parent Phone'        },
    { key: 'subject',          header: 'Subject'             },
    { key: 'classLevel',       header: 'Class'               },
    { key: 'area',             header: 'Area'                },
    { key: 'classesPerWeek',   header: 'Classes/Week'        },
    { key: 'startDate',        header: 'Start Date'          },
    { key: 'monthlyFeeParent', header: 'Parent Pays (₹/mo)'  },
    { key: 'monthlyFeeTutor',  header: 'Tutor Gets (₹/mo)'   },
    { key: 'status',           header: 'Status'              },
    { key: 'notes',            header: 'Notes'               },
  ];

  const sheet = makeSheet(assignments, cols);
  autoWidth(sheet, cols);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Assignments');
  download(wb, 'Jilani_CRM_Assignments');
}

// ── Export Communications ─────────────────────────────────────────────────────

export function exportCommunications(comms: CommunicationLog[]) {
  const cols: { key: keyof CommunicationLog; header: string }[] = [
    { key: 'date',           header: 'Date'            },
    { key: 'time',           header: 'Time'            },
    { key: 'contactName',    header: 'Contact Name'    },
    { key: 'contactType',    header: 'Type'            },
    { key: 'contactPhone',   header: 'Phone'           },
    { key: 'channel',        header: 'Channel'         },
    { key: 'notes',          header: 'Discussion'      },
    { key: 'outcome',        header: 'Outcome'         },
    { key: 'followUpDate',   header: 'Follow-up Date'  },
    { key: 'followUpStatus', header: 'Follow-up Status'},
    { key: 'handledBy',      header: 'Handled By'      },
  ];

  const sheet = makeSheet(comms, cols);
  autoWidth(sheet, cols);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Communications');
  download(wb, 'Jilani_CRM_Communications');
}

// ── Export Tasks ──────────────────────────────────────────────────────────────

export function exportTasks(tasks: Task[]) {
  const cols: { key: keyof Task; header: string }[] = [
    { key: 'title',          header: 'Task Title'      },
    { key: 'description',    header: 'Description'     },
    { key: 'assignedTo',     header: 'Assigned To'     },
    { key: 'relatedContact', header: 'Related Contact' },
    { key: 'dueDate',        header: 'Due Date'        },
    { key: 'priority',       header: 'Priority'        },
    { key: 'status',         header: 'Status'          },
  ];

  const sheet = makeSheet(tasks, cols);
  autoWidth(sheet, cols);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Tasks');
  download(wb, 'Jilani_CRM_Tasks');
}

// ── Export ALL data — Full CRM Report ────────────────────────────────────────

export function exportFullReport(data: {
  parents: Parent[];
  tutors: Tutor[];
  fees: FeeRecord[];
  assignments: Assignment[];
  attendance: AttendanceRecord[];
  comms: CommunicationLog[];
  tasks: Task[];
}) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Summary
  const confirmed   = data.fees.filter(f => f.paymentStatus !== 'pending');
  const totalRev    = confirmed.reduce((s,f) => s+(f.parentFee||0), 0);
  const totalTutor  = confirmed.reduce((s,f) => s+(f.tutorFee||0), 0);
  const totalProfit = totalRev - totalTutor;
  const attTotal    = data.attendance.filter(a => a.status !== 'holiday').length;
  const attPresent  = data.attendance.filter(a => a.status === 'present').length;
  const attRate     = attTotal ? Math.round((attPresent/attTotal)*100) : 0;
  const convRate    = data.parents.length ? Math.round((data.parents.filter(p=>p.status==='converted').length/data.parents.length)*100) : 0;

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['JILANI HOME TUTOR — CRM REPORT'],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [''],
    ['METRIC',              'VALUE'],
    ['Total Parents',       data.parents.length],
    ['Total Tutors',        data.tutors.length],
    ['Active Assignments',  data.assignments.filter(a=>a.status==='active').length],
    ['Total Fee Records',   data.fees.length],
    ['Total Revenue (₹)',   totalRev],
    ['Total Tutor Pay (₹)', totalTutor],
    ['Net Profit (₹)',      totalProfit],
    ['Attendance Rate',     `${attRate}%`],
    ['Conversion Rate',     `${convRate}%`],
    ['Total Comm Logs',     data.comms.length],
    ['Pending Tasks',       data.tasks.filter(t=>t.status!=='done').length],
  ]);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, '📊 Summary');

  // Other sheets
  const parentCols: { key: keyof Parent; header: string }[] = [
    { key:'name', header:'Name' }, { key:'phone', header:'Phone' },
    { key:'area', header:'Area' }, { key:'class', header:'Class' },
    { key:'subject', header:'Subject' }, { key:'status', header:'Status' },
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(data.parents, parentCols), '👨‍👩‍👧 Parents');

  const tutorCols: { key: keyof Tutor; header: string }[] = [
    { key:'name', header:'Name' }, { key:'phone', header:'Phone' },
    { key:'gender', header:'Gender' }, { key:'area', header:'Area' },
    { key:'qualification', header:'Qualification' }, { key:'subjects', header:'Subjects' },
    { key:'status', header:'Status' },
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(data.tutors, tutorCols), '👩‍🏫 Tutors');

  const feeCols: { key: keyof FeeRecord; header: string }[] = [
    { key:'tutorName', header:'Tutor' }, { key:'parentName', header:'Parent' },
    { key:'month', header:'Month' }, { key:'parentFee', header:'Parent Pays' },
    { key:'tutorFee', header:'Tutor Gets' }, { key:'profit', header:'Profit' },
    { key:'paymentStatus', header:'Status' },
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(data.fees, feeCols), '💰 Fees');

  const attCols: { key: keyof AttendanceRecord; header: string }[] = [
    { key:'date', header:'Date' }, { key:'studentName', header:'Student' },
    { key:'tutorName', header:'Tutor' }, { key:'subject', header:'Subject' },
    { key:'status', header:'Status' }, { key:'sessionDuration', header:'Mins' },
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(data.attendance, attCols), '📅 Attendance');

  download(wb, 'Jilani_CRM_Full_Report');
}
