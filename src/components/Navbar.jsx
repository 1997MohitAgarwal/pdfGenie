import React from "react";

export default function Navbar() {
    return (
      <nav className="bg-green-800 shadow-sm px-6 py-4 flex justify-between items-center border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <img
            src="/assets/images/file.png"
            alt="App Logo"
            width={50}
            height={50}
          />
          <h1 className="text-xl text-yellow-500 font-bold">
            PDF<span className="text-white">Genie.</span>
          </h1>
        </div>
      </nav>
    );
  }