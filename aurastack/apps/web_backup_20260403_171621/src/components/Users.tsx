import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { cn } from '../lib/utils';
import { 
  User, 
  Mail, 
  Shield, 
  MoreVertical, 
  UserPlus, 
  Circle,
  Clock,
  Search
} from 'lucide-react';
import { Dropdown } from './Dropdown';

export function Users() {
  const { users } = usePlatform();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === 'All' || user.role === selectedRole;
      const matchesStatus = selectedStatus === 'All' || user.status === selectedStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, selectedRole, selectedStatus]);

  const roles = ['All', 'Admin', 'Manager', 'Agent', 'Developer'];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="page-title">User Management</h3>
          <p className="text-sm text-[#64748B] mt-0.5">Manage platform access and permissions</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <UserPlus size={16} strokeWidth={1.5} />
          Invite User
        </button>
      </div>

      {/* Filters - aligned search + dropdowns */}
      <div className="filter-row">
        <div className="filter-search-wrap flex-1 min-w-0">
          <span className="filter-label">Search</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={16} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search by Name or Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base h-9 pl-9 pr-3"
            />
          </div>
        </div>
        <Dropdown 
          label="Role"
          options={roles.map(r => ({ label: r, value: r }))}
          value={selectedRole}
          onChange={setSelectedRole}
          className="w-full md:w-40"
        />
        <Dropdown 
          label="Status"
          options={['All', 'active', 'inactive'].map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
          value={selectedStatus}
          onChange={setSelectedStatus}
          className="w-full md:w-40"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <div key={user.id} className="card card-hover p-5 group">
            <div className="flex justify-between items-start mb-4">
              <div className="relative">
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white",
                  user.status === 'active' ? "bg-[#059669]" : "bg-[#94A3B8]"
                )} />
              </div>
              <button className="p-1.5 text-[#64748B] hover:bg-[#F8FAFC] rounded-lg transition-colors">
                <MoreVertical size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="card-title">{user.name}</h4>
                <div className="flex items-center gap-1.5 text-[#64748B] mt-0.5">
                  <Mail size={14} strokeWidth={1.5} />
                  <span className="text-sm font-normal text-[#64748B]">{user.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-[#E2E8F0]">
                <div className="flex-1">
                  <span className="meta-label block mb-0.5">Role</span>
                  <div className="flex items-center gap-1.5 text-sm font-normal text-[#0F172A]">
                    <Shield size={14} className="text-[#1F9D8B]" strokeWidth={1.5} />
                    {user.role}
                  </div>
                </div>
                <div className="flex-1">
                  <span className="meta-label block mb-0.5">Last Active</span>
                  <div className="flex items-center gap-1.5 text-sm font-normal text-[#0F172A]">
                    <Clock size={14} className="text-[#64748B]" strokeWidth={1.5} />
                    {new Date(user.lastActive).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
