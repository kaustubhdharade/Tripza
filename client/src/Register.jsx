import React, { useState } from 'react';

function Register({ onNavigateHome, onNavigateLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    userType: 'college_student',
    role: 'passenger',
    mis: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const backendUrl = import.meta.env.VITE_Backend_API || 'http://localhost:5000';
      console.log("Backend URL:", backendUrl);

      const response = await fetch(
        `${backendUrl}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            userType: formData.userType,
            mis: formData.mis,
            emergencyContact: {
              name: formData.emergencyContactName,
              phone: formData.emergencyContactPhone,
              relationship: formData.emergencyContactRelationship,
            },
          }),
        }
      );

      console.log("Response URL:", response.url);
      console.log("Status:", response.status);

      let data = {};
      const responseText = await response.text();
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          console.error("Failed to parse response JSON:", responseText, parseErr);
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `Registration failed with status ${response.status}`);
      }

      console.log("Registration successful:", data);
      alert("Registration successful! Please log in.");

      if (onNavigateLogin) {
        onNavigateLogin();
      }
    } catch (error) {
      console.error("Registration error:", error);
      alert(error.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header / Navigation */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10 border-b border-slate-800/60">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigateHome}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-indigo-500/20">
            T
          </div>
          <span className="font-extrabold tracking-wider text-2xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Tripza
          </span>
        </div>
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Home
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-2xl mx-auto px-6 py-10 flex-1 flex flex-col justify-center items-center text-center z-10">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2">
          Create an Account
        </h1>
        <p className="text-slate-400 font-medium mb-8">
          Join Tripza to book or offer rides seamlessly
        </p>

        {/* Registration Form Card */}
        <div className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-left">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* User Type & Role Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* User Type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  User Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, userType: 'college_student' }))}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${formData.userType === 'college_student'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    College Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, userType: 'outsider' }))}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${formData.userType === 'outsider'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Outsider
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, role: 'passenger' }))}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${formData.role === 'passenger'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Passenger
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, role: 'driver' }))}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${formData.role === 'driver'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Driver
                  </button>
                </div>
              </div>
            </div>

            {/* Basic Info: Name, Email, Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  MIS {formData.userType === 'college_student' ? '(Required)' : '(Optional)'}
                </label>
                <input
                  type="text"
                  name="mis"
                  value={formData.mis}
                  onChange={handleChange}
                  placeholder="Enter MIS number"
                  className="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            {/* Emergency Contact Section */}
            <div className="pt-2 border-t border-slate-800/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
                Emergency Contact
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={handleChange}
                    placeholder="Enter emergency contact name"
                    className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="emergencyContactPhone"
                      value={formData.emergencyContactPhone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      name="emergencyContactRelationship"
                      value={formData.emergencyContactRelationship}
                      onChange={handleChange}
                      placeholder="e.g. Parent, Sibling, Friend"
                      className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-[0.99] transition-all font-bold text-white shadow-xl shadow-indigo-600/25 text-base cursor-pointer mt-4"
            >
              Register
            </button>
          </form>
          <div className="text-center pt-3">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onNavigateLogin}
                className="text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-5 text-center text-xs text-slate-500 border-t border-slate-800/60 z-10">
        Tripza &copy; {new Date().getFullYear()} — Your smart local ride platform
      </footer>
    </div>
  );
}

export default Register;
