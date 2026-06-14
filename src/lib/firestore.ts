// src/lib/firestore.ts
import {
  collection, addDoc, getDocs, doc, updateDoc,
  setDoc, getDoc, deleteDoc, query, orderBy,
  serverTimestamp, where, Firestore,
} from 'firebase/firestore';
import { getDbInstance } from './firebase';

const db = () => getDbInstance();

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeadStatus      = 'new' | 'contacted' | 'demo_scheduled' | 'converted' | 'closed';
export type ClassStatus     = 'active' | 'paused' | 'completed';
export type AttendanceStatus= 'present' | 'absent' | 'holiday' | 'cancelled';
export type CommChannel     = 'call' | 'whatsapp' | 'visit' | 'email' | 'sms';
export type TaskPriority    = 'high' | 'medium' | 'low';
export type TaskStatus      = 'pending' | 'in_progress' | 'done';
export type StaffRole       = 'admin' | 'manager' | 'staff';

export interface Parent {
  id?: string;
  name: string; phone: string; email?: string;
  area: string; class: string; subject: string;
  status: LeadStatus; notes: string;
  preferredGender?: string; budget?: string;
  source?: string; // how they found us
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
}

export interface Tutor {
  id?: string;
  name: string; phone: string; email?: string;
  gender: string; area: string;
  qualification: string; subjects: string; classes: string;
  experience?: string; availability?: string;
  status: LeadStatus; notes: string;
  monthlyFee?: number;
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
}

export interface Assignment {
  id?: string;
  tutorId?: string; tutorName: string; tutorPhone: string;
  parentId?: string; parentName: string; parentPhone: string;
  subject: string; classLevel: string;
  classesPerWeek: number; startDate: string;
  monthlyFeeParent: number; monthlyFeeTutor: number;
  status: ClassStatus; area: string; notes: string;
  createdAt?: { seconds: number };
}

export interface FeeRecord {
  id?: string;
  assignmentId?: string;
  tutorName: string; parentName: string;
  subject: string; classLevel: string;
  parentFee: number; tutorFee: number; profit: number;
  month: string;
  paymentStatus: 'pending' | 'received' | 'paid';
  notes: string;
  createdAt?: { seconds: number };
}

export interface AttendanceRecord {
  id?: string;
  studentName: string; tutorName: string;
  subject: string; classLevel: string;
  date: string; status: AttendanceStatus;
  sessionDuration: number; notes: string;
  createdAt?: { seconds: number };
}

export interface CommunicationLog {
  id?: string;
  contactName: string; contactType: 'parent' | 'tutor';
  contactPhone: string; channel: CommChannel;
  date: string; time: string;
  notes: string; outcome: string;
  followUpDate: string;
  followUpStatus: 'none' | 'pending' | 'done';
  handledBy: string;
  createdAt?: { seconds: number };
}

export interface Task {
  id?: string;
  title: string; description: string;
  assignedTo: string; relatedContact: string;
  dueDate: string; priority: TaskPriority;
  status: TaskStatus;
  createdAt?: { seconds: number };
}

export interface StaffMember {
  id?: string;
  name: string; email: string; phone: string;
  role: StaffRole; status: 'active' | 'inactive';
  joinDate: string; notes: string;
  createdAt?: { seconds: number };
}

export interface SiteConfig {
  offerBanner: string; whatsappNumber: string;
  heroSubtext: string; address: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const snap2arr = <T>(snap: any): T[] => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));

// ─── Parents ──────────────────────────────────────────────────────────────────

export const getParents  = async (): Promise<Parent[]>  => snap2arr(await getDocs(query(collection(db(), 'parents'),  orderBy('createdAt','desc'))));
export const addParent   = (d: Omit<Parent,'id'|'createdAt'|'updatedAt'>) => addDoc(collection(db(),'parents'), {...d, createdAt:serverTimestamp(), updatedAt:serverTimestamp()});
export const updateParent= (id:string, d:Partial<Parent>) => updateDoc(doc(db(),'parents',id), {...d, updatedAt:serverTimestamp()});
export const deleteParent= (id:string) => deleteDoc(doc(db(),'parents',id));

// ─── Tutors ───────────────────────────────────────────────────────────────────

export const getTutors  = async (): Promise<Tutor[]>  => snap2arr(await getDocs(query(collection(db(), 'tutors'),  orderBy('createdAt','desc'))));
export const addTutor   = (d: Omit<Tutor,'id'|'createdAt'|'updatedAt'>) => addDoc(collection(db(),'tutors'), {...d, createdAt:serverTimestamp(), updatedAt:serverTimestamp()});
export const updateTutor= (id:string, d:Partial<Tutor>) => updateDoc(doc(db(),'tutors',id), {...d, updatedAt:serverTimestamp()});
export const deleteTutor= (id:string) => deleteDoc(doc(db(),'tutors',id));

// Used by the website registration form
export const registerParent = (d: any) => addDoc(collection(db(),'parents'), {...d, status:'new', createdAt:serverTimestamp()});
export const registerTutor  = (d: any) => addDoc(collection(db(),'tutors'),  {...d, status:'new', createdAt:serverTimestamp()});

// ─── Assignments ──────────────────────────────────────────────────────────────

export const getAssignments  = async (): Promise<Assignment[]>  => snap2arr(await getDocs(query(collection(db(), 'classes'), orderBy('createdAt','desc'))));
export const addAssignment   = (d: Omit<Assignment,'id'|'createdAt'>) => addDoc(collection(db(),'classes'), {...d, createdAt:serverTimestamp()});
export const updateAssignment= (id:string, d:Partial<Assignment>) => updateDoc(doc(db(),'classes',id), d);
export const deleteAssignment= (id:string) => deleteDoc(doc(db(),'classes',id));

// ─── Fees ─────────────────────────────────────────────────────────────────────

export const getFees  = async (): Promise<FeeRecord[]>  => snap2arr(await getDocs(query(collection(db(), 'fees'), orderBy('createdAt','desc'))));
export const addFee   = (d: Omit<FeeRecord,'id'|'createdAt'>) => addDoc(collection(db(),'fees'), {...d, profit:d.parentFee-d.tutorFee, createdAt:serverTimestamp()});
export const updateFee= (id:string, d:Partial<FeeRecord>) => updateDoc(doc(db(),'fees',id), {...d, ...(d.parentFee!==undefined&&d.tutorFee!==undefined?{profit:d.parentFee-d.tutorFee}:{})});
export const deleteFee= (id:string) => deleteDoc(doc(db(),'fees',id));

// ─── Attendance ───────────────────────────────────────────────────────────────

export const getAttendance  = async (): Promise<AttendanceRecord[]>  => snap2arr(await getDocs(query(collection(db(), 'attendance'), orderBy('date','desc'))));
export const addAttendance  = (d: Omit<AttendanceRecord,'id'|'createdAt'>) => addDoc(collection(db(),'attendance'), {...d, createdAt:serverTimestamp()});
export const updateAttendance=(id:string, d:Partial<AttendanceRecord>) => updateDoc(doc(db(),'attendance',id), d);
export const deleteAttendance=(id:string) => deleteDoc(doc(db(),'attendance',id));

// ─── Communications ───────────────────────────────────────────────────────────

export const getComms  = async (): Promise<CommunicationLog[]>  => snap2arr(await getDocs(query(collection(db(), 'communications'), orderBy('createdAt','desc'))));
export const addComm   = (d: Omit<CommunicationLog,'id'|'createdAt'>) => addDoc(collection(db(),'communications'), {...d, createdAt:serverTimestamp()});
export const updateComm= (id:string, d:Partial<CommunicationLog>) => updateDoc(doc(db(),'communications',id), d);
export const deleteComm= (id:string) => deleteDoc(doc(db(),'communications',id));

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const getTasks  = async (): Promise<Task[]>  => snap2arr(await getDocs(query(collection(db(), 'tasks'), orderBy('dueDate','asc'))));
export const addTask   = (d: Omit<Task,'id'|'createdAt'>) => addDoc(collection(db(),'tasks'), {...d, createdAt:serverTimestamp()});
export const updateTask= (id:string, d:Partial<Task>) => updateDoc(doc(db(),'tasks',id), d);
export const deleteTask= (id:string) => deleteDoc(doc(db(),'tasks',id));

// ─── Staff ────────────────────────────────────────────────────────────────────

export const getStaff  = async (): Promise<StaffMember[]>  => snap2arr(await getDocs(query(collection(db(), 'staff'), orderBy('createdAt','desc'))));
export const addStaff  = (d: Omit<StaffMember,'id'|'createdAt'>) => addDoc(collection(db(),'staff'), {...d, createdAt:serverTimestamp()});
export const updateStaff=(id:string, d:Partial<StaffMember>) => updateDoc(doc(db(),'staff',id), d);
export const deleteStaff=(id:string) => deleteDoc(doc(db(),'staff',id));

// ─── Config ───────────────────────────────────────────────────────────────────

export const getConfig  = async (): Promise<SiteConfig|null> => { const s=await getDoc(doc(db(),'config','site')); return s.exists() ? s.data() as SiteConfig : null; };
export const saveConfig = (d:SiteConfig) => setDoc(doc(db(),'config','site'), {...d, updatedAt:serverTimestamp()});
