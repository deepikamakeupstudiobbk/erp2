import React, { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { X, ShieldAlert, Mail, Lock, Eye, EyeOff, KeyRound, UserCheck } from 'lucide-react';
import { STUDIO_INFO, STUDIO_LOGO } from '../../data/initialData';
import { ERPApp } from '../erp/ERPApp';

/** ERP ka darwaza: Owner / Staff login. Login ke baad naya ERP dashboard (components/erp) khulta hai. */
export const ERPModal: React.FC = () => {
  const { isERPModalOpen, closeERPModal, session, loginAsOwner, loginAsEmployee } = useStudio();

  const [loginRole, setLoginRole] = useState<'owner' | 'employee'>('owner');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [staffLoginId, setStaffLoginId] = useState('');
  const [isStaffLoggingIn, setIsStaffLoggingIn] = useState(false);
  const [employeePassword, setEmployeePassword] = useState('');
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const isAuthenticated = session.role === 'owner' || session.role === 'employee';

  const handleOwnerLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const success = loginAsOwner(ownerPassword, ownerUsername);
    if (!success) {
      setLoginError(`Authentication failed. Please verify your Owner Username/Email or Password.`);
    }
  };

  // Handle Employee Login (Google Sheet ke Staff tab se check hota hai)
  const handleEmployeeLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsStaffLoggingIn(true);
    const success = await loginAsEmployee(staffLoginId, employeePassword);
    setIsStaffLoggingIn(false);
    if (success) {
      setEmployeePassword('');
    } else {
      setLoginError('Login ID ya password galat hai. Owner se check karein.');
    }
  };

  if (!isERPModalOpen) return null;

  if (isAuthenticated) return <ERPApp />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <div className="relative w-full max-w-md bg-stone-950 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-6 bg-gradient-to-b from-stone-900 to-stone-950 border-b border-stone-800 text-center relative">
            <button
              onClick={closeERPModal}
              className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-white rounded-lg bg-stone-800/60 hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400/80 mx-auto mb-3 shadow-xl bg-stone-900">
              <img src={STUDIO_LOGO} alt="Deepika Sharma Monogram Logo" className="w-full h-full object-cover" />
            </div>

            <h2 className="font-serif-luxury text-2xl font-bold text-white tracking-wide">
              {STUDIO_INFO.shortName}
            </h2>
            <p className="text-xs text-amber-300 uppercase tracking-widest font-medium mt-0.5">
              Enterprise Salon ERP Portal
            </p>
            <p className="text-[11px] text-stone-400 mt-1">
              {STUDIO_INFO.landmark}, {STUDIO_INFO.city}
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-stone-900 border-b border-stone-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setLoginRole('owner'); setLoginError(''); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                loginRole === 'owner'
                  ? 'bg-amber-400 text-stone-950 shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Studio Owner (Admin)</span>
            </button>

            <button
              type="button"
              onClick={() => { setLoginRole('employee'); setLoginError(''); }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                loginRole === 'employee'
                  ? 'bg-amber-400 text-stone-950 shadow'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Staff Employee</span>
            </button>
          </div>

          {/* Error Notice */}
          {loginError && (
            <div className="mx-6 mt-4 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Owner Login Form */}
          {loginRole === 'owner' && (
            <form onSubmit={handleOwnerLoginSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-300">
                  Owner Username / Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    required
                    value={ownerUsername}
                    onChange={(e) => setOwnerUsername(e.target.value)}
                    placeholder="admin or engdksmegasoft@gmail.com"
                    className="w-full pl-9 p-2 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-300">
                  Master Security Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-stone-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 p-2 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-right text-[11px] text-amber-300/80">Full Rights Control</div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all"
              >
                Sign In to Owner ERP
              </button>

            </form>
          )}

          {/* Employee Login Form */}
          {loginRole === 'employee' && (() => {
            return (
              <form onSubmit={handleEmployeeLoginSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-300">Staff Login ID</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-stone-500" />
                    <input
                      type="text"
                      required
                      autoCapitalize="none"
                      value={staffLoginId}
                      onChange={(e) => { setStaffLoginId(e.target.value); setLoginError(''); }}
                      placeholder="Owner ne jo Login ID di hai"
                      className="w-full pl-9 p-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-stone-300">
                      Staff Login Password
                    </label>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-stone-500" />
                    <input
                      type={showEmployeePassword ? 'text' : 'password'}
                      required
                      value={employeePassword}
                      onChange={(e) => setEmployeePassword(e.target.value)}
                      placeholder="Enter staff login password"
                      className="w-full pl-9 pr-9 p-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-white cursor-pointer"
                    >
                      {showEmployeePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  {isStaffLoggingIn ? 'Login ho raha hai...' : 'Log In as Staff Member'}
                </button>
              </form>
            );
          })()}

        </div>
    </div>
  );
};
