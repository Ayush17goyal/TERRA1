import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, LineChart, Line } from 'recharts';
import type { ProgressMetricPoint } from '../types/learning.types';

export function LearningAreaChart({ data }: { data: ProgressMetricPoint[] }) {
  return <ResponsiveContainer width="100%" height={190}><AreaChart data={data}><defs><linearGradient id="learningGold" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#f5c14f" stopOpacity={0.55}/><stop offset="95%" stopColor="#f5c14f" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="label" stroke="rgba(244,239,229,0.55)" fontSize={11} /><YAxis stroke="rgba(244,239,229,0.55)" fontSize={11} /><Tooltip contentStyle={{ background: '#0a1020', border: '1px solid rgba(245,193,79,0.2)', color: '#f4efe5' }} /><Area type="monotone" dataKey="value" stroke="#f5c14f" fill="url(#learningGold)" /></AreaChart></ResponsiveContainer>;
}

export function LearningBarChart({ data }: { data: ProgressMetricPoint[] }) {
  return <ResponsiveContainer width="100%" height={190}><BarChart data={data}><CartesianGrid stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="label" stroke="rgba(244,239,229,0.55)" fontSize={11} /><YAxis stroke="rgba(244,239,229,0.55)" fontSize={11} /><Tooltip contentStyle={{ background: '#0a1020', border: '1px solid rgba(245,193,79,0.2)', color: '#f4efe5' }} /><Bar dataKey="value" fill="#f5c14f" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>;
}

export function LearningLineChart({ data }: { data: ProgressMetricPoint[] }) {
  return <ResponsiveContainer width="100%" height={190}><LineChart data={data}><CartesianGrid stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="label" stroke="rgba(244,239,229,0.55)" fontSize={11} /><YAxis stroke="rgba(244,239,229,0.55)" fontSize={11} /><Tooltip contentStyle={{ background: '#0a1020', border: '1px solid rgba(245,193,79,0.2)', color: '#f4efe5' }} /><Line type="monotone" dataKey="value" stroke="#8ee8bd" strokeWidth={2} dot={{ fill: '#8ee8bd' }} /></LineChart></ResponsiveContainer>;
}
