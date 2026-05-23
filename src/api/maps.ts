import client from './client';
import type { Zone, AssemblyPoint } from '../types/api';

export interface Floor {
  id: string;
  name: string;
  floorplanId?: string;
  floorplanUrl?: string;
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
}

export interface Site {
  id: string;
  name: string;
  address: string;
  buildings: Building[];
}

export interface Establishment {
  name: string;
  type: string;
  sites: Site[];
}

export async function getEstablishment(): Promise<Establishment | null> {
  const { data } = await client.get<Establishment | null>('/maps/establishment');
  return data;
}

export interface FloorplanOverlay {
  zones: Array<{ id: string; name: string; points?: { x: number; y: number }[]; color?: string; labelName?: string }>;
  devices: Array<{ id: string; name: string; type: string; x: number; y: number; zoneId?: string }>;
  boundary: Array<{ x: number; y: number }> | null;
}

export async function getFloorplanOverlay(floorplanId: string): Promise<FloorplanOverlay> {
  const { data } = await client.get<FloorplanOverlay>(`/maps/floorplan-overlay/${floorplanId}`);
  return data || { zones: [], devices: [], boundary: null };
}

export interface SiteWithZones {
  id: string;
  name: string;
  zones: { id: string; name: string }[];
}

export async function getSitesWithZones(): Promise<SiteWithZones[]> {
  const { data } = await client.get<SiteWithZones[]>('/maps/sites-with-zones');
  return data;
}

export interface BuildingDetail {
  id: string;
  name: string;
  floors: { id: string; name: string; imageUrl?: string }[];
}

export async function getZones(): Promise<Zone[]> {
  const { data } = await client.get<Zone[]>('/maps/zones');
  return data;
}

export interface Scenario {
  id: string;
  name: string;
  type: 'lockdown' | 'evacuate' | 'invacuate' | 'standby' | 'test';
  priority: 'critical' | 'high' | 'medium';
}

export async function getScenarios(): Promise<Scenario[]> {
  const { data } = await client.get<Scenario[]>('/maps/scenarios');
  return data;
}

export async function getAssemblyPoints(): Promise<AssemblyPoint[]> {
  const { data } = await client.get<AssemblyPoint[]>('/maps/assembly-points');
  return data;
}

export async function getBuilding(id: string): Promise<BuildingDetail> {
  const { data } = await client.get<BuildingDetail>(`/maps/building/${id}`);
  return data;
}
