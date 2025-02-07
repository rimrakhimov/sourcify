import {
  InjectorInput,
  Match,
  Logger,
  IFileService,
  Metadata,
  JsonInput,
  CheckedContract,
} from "@ethereum-sourcify/core";
import { Injector } from "./Injector";
import * as bunyan from "bunyan";
import { findContractPathFromContractName, useCompiler } from "../utils";

export interface IVerificationService {
  findByAddress(address: string, chain: string): Match[];
  findAllByAddress(address: string, chain: string): Match[];
  inject(injectorInput: InjectorInput): Promise<Match>;
  getMetadataFromJsonInput(
    compilerVersion: string,
    contractName: string,
    compilerJson: any
  ): Promise<Metadata>;
  verifyCreate2(
    contract: CheckedContract,
    deployerAddress: string,
    salt: string,
    constructorArgs: any,
    create2Address: string
  ): Promise<Match>;
  recompile(contract: CheckedContract): Promise<any>;
  getBytecode(address: string, chain: string): Promise<string>;
}

export class VerificationService implements IVerificationService {
  fileService: IFileService;
  logger: bunyan;
  private injector: Injector | undefined;

  constructor(fileService: IFileService, logger?: bunyan) {
    this.fileService = fileService;
    this.logger = logger || Logger("VerificationService");
  }

  getMetadataFromJsonInput = async (
    compilerVersion: string,
    contractName: string,
    compilerJson: JsonInput
  ): Promise<Metadata> => {
    const output = await useCompiler(
      compilerVersion,
      compilerJson,
      this.logger
    );
    const contractPath = findContractPathFromContractName(
      output.contracts,
      contractName
    );

    if (!contractPath)
      throw new Error(`Contract ${contractName} not found in compiler output`);

    if (
      !output.contracts ||
      !output.contracts[contractPath] ||
      !output.contracts[contractPath][contractName] ||
      !output.contracts[contractPath][contractName].metadata
    ) {
      const errorMessages = output.errors
        .filter((e: any) => e.severity === "error")
        .map((e: any) => e.formattedMessage)
        .join("\n");
      this.logger.error({
        loc: "[VERIFY-WITH-JSON]",
        contractPath,
        contractName,
        compilerVersion,
        errorMessages,
      });
      throw new Error("Compiler error:\n " + errorMessages);
    }

    return JSON.parse(
      output.contracts[contractPath][contractName].metadata.trim()
    );
  };

  findByAddress = (address: string, chain: string): Match[] => {
    // Try to find by address, return on success.
    let matches: Match[] = [];
    try {
      matches = this.fileService.findByAddress(address, chain);
    } catch (err) {
      const msg = "Could not find file in repository";
      this.logger.info(
        {
          loc: "[POST:VERIFICATION_BY_ADDRESS_FAILED]",
          address: address,
        },
        msg
      );
    }
    return matches;
  };

  findAllByAddress = (address: string, chain: string): Match[] => {
    // Try to find by address, return on success.
    let matches: Match[] = [];
    try {
      matches = this.fileService.findAllByAddress(address, chain);
    } catch (err) {
      const msg = "Could not find file in repository";
      this.logger.info(
        {
          loc: "[POST:VERIFICATION_BY_ADDRESS_FAILED]",
          address: address,
        },
        msg
      );
    }
    return matches;
  };

  inject = async (injectorInput: InjectorInput): Promise<Match> => {
    if (!this.injector) {
      this.injector = await Injector.createAsync({
        log: this.logger,
        repositoryPath: this.fileService.repositoryPath,
        fileService: this.fileService,
        web3timeout: parseInt(process.env.WEB3_TIMEOUT || "") || undefined,
      });
    }

    return this.injector.inject(injectorInput);
  };

  verifyCreate2 = async (
    contract: CheckedContract,
    deployerAddress: string,
    salt: string,
    constructorArgs: any,
    create2Address: string
  ): Promise<Match> => {
    if (!this.injector) {
      this.injector = await Injector.createAsync({
        log: this.logger,
        repositoryPath: this.fileService.repositoryPath,
        fileService: this.fileService,
        web3timeout: parseInt(process.env.WEB3_TIMEOUT || "") || undefined,
      });
    }

    return await this.injector.verifyCreate2(
      contract,
      deployerAddress,
      salt,
      constructorArgs,
      create2Address
    );
  };

  recompile = async (contract: CheckedContract): Promise<any> => {
    if (!this.injector) {
      this.injector = await Injector.createAsync({
        log: this.logger,
        repositoryPath: this.fileService.repositoryPath,
        fileService: this.fileService,
        web3timeout: parseInt(process.env.WEB3_TIMEOUT || "") || undefined,
      });
    }

    return await this.injector.recompile(contract);
  };

  getBytecode = async (address: string, chainId: string): Promise<any> => {
    if (!this.injector) {
      this.injector = await Injector.createAsync({
        log: this.logger,
        repositoryPath: this.fileService.repositoryPath,
        fileService: this.fileService,
        web3timeout: parseInt(process.env.WEB3_TIMEOUT || "") || undefined,
      });
    }

    return await this.injector.getBytecode(address, chainId);
  };
}
