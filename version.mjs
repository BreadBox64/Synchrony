const {log} = global.moduleExport

/**
 * 
 */
export class Version {
	#versionRegex = /(\d+)\.(\d+)\.(\d+)(?:-([b|n])(\d+))?/;
	major;
	minor;
	patch;
	flag;
	flagv;

	/**
	 * 
	 * @param {string|[number, number, number, string?, number?]} args 
	 */
  constructor(args) {
		if(typeof(args) === "string") this.#fromString(args); else this.#fromValues(args)
  }

	#fromString(inputStr) {
		let versionIter = inputStr.match(this.#versionRegex)
		
		this.major = parseInt(versionIter[1])
		this.minor = parseInt(versionIter[2])
		this.patch = parseInt(versionIter[3])

		if(versionIter[5] != null) {
			this.flag = versionIter[4]
			this.flagv = parseInt(versionIter[5])
		}
	}
  
	#fromValues(values) {
		this.major = values[0]
		this.minor = values[1]
		this.patch = values[2]
		this.flag ??= values[3]
		this.flagv ??= values[4]
	}
	
	/**
	 * Greater Than
	 * @param {Version} version 
	 */
	gt(version) {
		if(this.major > version.major) return true
		if(this.minor > version.minor) return true
		if(this.patch > version.patch) return true
		if(this.flag && this.flag === version.flag && this.flagv > version.flagv) return true
		return false
	}

	/**
	 * Less Than Or Equal
	 * @param {Version} version 
	 */
	lte(version) {
		return !this.gt(version)
	}

	/**
	 * Less Than
	 * @param {Version} version 
	 */
	lt(version) {
		if(this.major < version.major) return true
		if(this.minor < version.minor) return true
		if(this.patch < version.patch) return true
		if(this.flag && this.flag === version.flag && this.flagv < version.flagv) return true
		return false
	}

	/**
	 * Greater Than Or Equal
	 * @param {Version} version 
	 */
	gte(version) {
		return !this.lt(version)
	}

	/**
	 * Equal To
	 * @param {Version} version 
	 */
	eq(version) {
		return (
			this.major === version.major &&
			this.minor === version.minor &&
			this.patch === version.patch &&
			this.flag === version.flag &&
			this.flagv === version.flagv
		)
	}
}